import { Elysia, t } from "elysia";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../auth/session";
import { database } from "../database";
import { integrations } from "../database/schema/integrations";
import { encrypt, decrypt } from "@nyx/shared";
import { validateGeminiKey } from "../lib/ai/gemini";

async function upsertIntegration(userId: string, provider: string, apiKey: string) {
  const encryptedApiKey = encrypt(apiKey);
  const existing = await database
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)))
    .limit(1);

  if (existing.length > 0) {
    await database
      .update(integrations)
      .set({ encryptedApiKey })
      .where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)));
  } else {
    await database.insert(integrations).values({ userId, provider, encryptedApiKey });
  }
}

async function removeIntegration(userId: string, provider: string) {
  return database
    .delete(integrations)
    .where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)));
}

// In-memory voice cache (TTL: 1h)
let voiceCache: { data: unknown; expiresAt: number } | null = null;

function maskApiKey(encrypted: string): string {
  try {
    const plain = decrypt(encrypted);
    return plain.length <= 4 ? "****" : `****${plain.slice(-4)}`;
  } catch {
    return "****";
  }
}

export const integrationRoutes = new Elysia({ prefix: "/api/integrations" })
  .use(requireAuth)

  // List integrations (masked keys)
  .get("/", async ({ session }) => {
    const rows = await database
      .select()
      .from(integrations)
      .where(eq(integrations.userId, session.user.id));

    return rows.map((r) => ({
      provider: r.provider,
      maskedKey: maskApiKey(r.encryptedApiKey),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  })

  // Upsert Talkify API key
  .put(
    "/talkify",
    async ({ session, body, set }) => {
      const apiKey = body.apiKey.trim();
      if (!apiKey) {
        set.status = 400;
        return { error: "apiKey is required" };
      }
      await upsertIntegration(session.user.id, "talkify", apiKey);
      return { ok: true };
    },
    { body: t.Object({ apiKey: t.String() }) },
  )

  // Remove Talkify integration
  .delete("/talkify", async ({ session, set }) => {
    const result = await removeIntegration(session.user.id, "talkify");
    if (!result.length) {
      set.status = 404;
      return { error: "integration not found" };
    }
    return { ok: true };
  })

  // Upsert Gemini API key — validated against the Google API before saving
  .put(
    "/gemini",
    async ({ session, body, set }) => {
      const apiKey = body.apiKey.trim();
      if (!apiKey) {
        set.status = 400;
        return { error: "apiKey is required" };
      }
      if (!(await validateGeminiKey(apiKey))) {
        set.status = 400;
        return { error: "chave inválida" };
      }
      await upsertIntegration(session.user.id, "gemini", apiKey);
      return { ok: true, maskedKey: `****${apiKey.slice(-4)}` };
    },
    { body: t.Object({ apiKey: t.String() }) },
  )

  // Remove Gemini integration
  .delete("/gemini", async ({ session, set }) => {
    const result = await removeIntegration(session.user.id, "gemini");
    if (!result.length) {
      set.status = 404;
      return { error: "integration not found" };
    }
    return { ok: true };
  })

  // List Talkify voices (public endpoint proxied + cached 1h)
  .get("/talkify/voices", async ({ set }) => {
    const now = Date.now();
    if (voiceCache && voiceCache.expiresAt > now) {
      return voiceCache.data;
    }

    const res = await fetch("https://api.talkifylabs.com/voices");
    if (!res.ok) {
      set.status = 502;
      return { error: "failed to fetch voices from Talkify" };
    }

    const data = await res.json();
    voiceCache = { data, expiresAt: now + 60 * 60 * 1000 };
    return data;
  });
