import { logger } from "./logger";

const AUTH_URL = "https://auth.raphaelai.org";
const API_URL = "https://api.raphaelai.org";
const CDN_URL = "https://cdn.raphaelai.org";

const PROXY_URL = process.env.RAPHAEL_PROXY_URL ?? undefined;

// Wraps fetch with optional proxy support (Bun native proxy option).
// Set RAPHAEL_PROXY_URL=http://user:pass@host:port to route all Raphael traffic through a proxy.
function proxyFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!PROXY_URL) return fetch(url, init);
  return fetch(url, { ...init, proxy: PROXY_URL } as RequestInit & { proxy: string });
}

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0",
  "Origin": "https://raphaelai.org",
  "Referer": "https://raphaelai.org/",
};

interface RaphaelSession {
  bearerToken: string;
  cookieHeader: string;
  expiresAt: number;
}

let cachedSession: RaphaelSession | null = null;

async function getSession(): Promise<RaphaelSession> {
  if (cachedSession && Date.now() < cachedSession.expiresAt - 30_000) {
    return cachedSession;
  }

  // Sign in with email/password to get session cookie
  const signInRes = await proxyFetch(`${AUTH_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { ...BROWSER_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.RAPHAEL_EMAIL!,
      password: process.env.RAPHAEL_PASSWORD!,
    }),
  });

  if (!signInRes.ok) {
    throw new Error(`Raphael sign-in failed: ${signInRes.status}`);
  }

  const setCookies = signInRes.headers.getSetCookie();
  const cookieHeader = setCookies.map(c => c.split(";")[0]).join("; ");

  // Exchange session cookie for bearer token
  const tokenRes = await proxyFetch(`${AUTH_URL}/api/auth/token`, {
    headers: { ...BROWSER_HEADERS, "Cookie": cookieHeader },
  });

  if (!tokenRes.ok) {
    throw new Error(`Raphael token fetch failed: ${tokenRes.status}`);
  }

  const { data } = await tokenRes.json() as { data: { token: string } };
  const token = data.token;

  // JWT expires in ~10 minutes; cache for 9
  cachedSession = {
    bearerToken: token,
    cookieHeader,
    expiresAt: Date.now() + 9 * 60 * 1000,
  };

  logger.info("Raphael session refreshed");
  return cachedSession;
}

async function refreshBearerToken(cookieHeader: string): Promise<string> {
  const tokenRes = await proxyFetch(`${AUTH_URL}/api/auth/token`, {
    headers: { ...BROWSER_HEADERS, "Cookie": cookieHeader },
  });
  
  if (!tokenRes.ok) throw new Error(`Raphael token refresh failed: ${tokenRes.status}`);
  const { data } = await tokenRes.json() as { data: { token: string } };
  const token = data.token;

  if (cachedSession) {
    cachedSession.bearerToken = token;
    cachedSession.expiresAt = Date.now() + 9 * 60 * 1000;
  }

  return token;
}

export async function generateImage(prompt: string, width = 1024, height = 576): Promise<Buffer> {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await _generateImage(prompt, width, height);
    } catch (err) {
      const status = (err as any).status;
      if (attempt === MAX_RETRIES || status === 400) throw err;
      const delay = status === 429 ? 65_000 : 4_000 * attempt;

      logger.warn({ attempt, delay, err: err instanceof Error ? err.message : err }, "Raphael image failed, retrying");
      await Bun.sleep(delay);
    }
  }
  
  throw new Error("unreachable");
}

async function _generateImage(prompt: string, width = 1024, height = 576): Promise<Buffer> {
  const session = await getSession();

  // Submit job
  const jobRes = await proxyFetch(`${API_URL}/v1/image/jobs`, {
    method: "POST",
    headers: {
      ...BROWSER_HEADERS,
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.bearerToken}`,
      "Cookie": session.cookieHeader,
    },
    body: JSON.stringify({ prompt, width, height }),
  });

  if (!jobRes.ok) {
    const body = await jobRes.text().catch(() => "(unreadable)");
    const err = new Error(`Raphael job submit failed: ${jobRes.status} — ${body}`);
    (err as any).status = jobRes.status;
    throw err;
  }

  const { data: jobData } = await jobRes.json() as { data: { jobId: string; pollToken: string } };

  // Poll via SSE
  const imageUrl = await pollJob(jobData.jobId, jobData.pollToken, session);
  logger.info({ jobId: jobData.jobId, imageUrl }, "Raphael image ready");

  // Download image
  const imgRes = await proxyFetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to download Raphael image: ${imgRes.status}`);
  return Buffer.from(await imgRes.arrayBuffer());
}

async function pollJob(jobId: string, pollToken: string, session: RaphaelSession): Promise<string> {
  const MAX_RECONNECTS = 10;
  let bearer = session.bearerToken;

  for (let attempt = 0; attempt < MAX_RECONNECTS; attempt++) {
    if (attempt > 0) {
      await Bun.sleep(2_000);
      logger.debug({ jobId, attempt }, "Raphael SSE reconnecting");
    }

    const res = await proxyFetch(`${API_URL}/v1/jobs/${jobId}/events`, {
      headers: {
        ...BROWSER_HEADERS,
        "Accept": "text/event-stream",
        "Authorization": `Bearer ${bearer}`,
        "x-job-poll-token": pollToken,
        "Cookie": session.cookieHeader,
      },
    });

    if (res.status === 401) {
      bearer = await refreshBearerToken(session.cookieHeader);
      attempt--; // don't count 401 as a reconnect attempt
      continue;
    }

    if (!res.ok || !res.body) {
      throw new Error(`Raphael SSE connect failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) { streamDone = true; break; }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;

        try {
          const event = JSON.parse(raw) as { status?: string; outputUrl?: string; output_url?: string };
          if (event.status === "completed" || event.outputUrl || event.output_url) {
            const url = event.outputUrl ?? event.output_url;
            if (url) return url;
          }
          if (event.status === "failed") {
            throw new Error("Raphael image generation failed");
          }
        } catch (e) {
          if (e instanceof Error && e.message === "Raphael image generation failed") throw e;
          // ignore malformed SSE lines
        }
      }
    }

    // Stream closed without result — reconnect
  }

  throw new Error(`Raphael SSE gave no result after ${MAX_RECONNECTS} reconnects`);
}
