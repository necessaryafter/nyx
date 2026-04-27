const BASE_URL = process.env.NYX_API_URL!;
const API_KEY = process.env.NYX_API_KEY!;

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${API_KEY}`,
};

export interface Template {
  id: string;
  name: string;
  graph: unknown;
  createdAt: string;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
}

export interface Job {
  id: string;
  status: "pending" | "processing" | "done" | "failed";
  videoKey?: string;
  error?: string;
}

export async function listTemplates(): Promise<Template[]> {
  const res = await fetch(`${BASE_URL}/api/templates?limit=25`, { headers });
  if (!res.ok) throw new Error(`Failed to list templates: ${res.status}`);
  const body = await res.json() as { data: Template[] };
  return body.data;
}

export async function uploadAsset(filename: string, buffer: Buffer, mimeType: string, type: "video" | "audio" | "image" = "image"): Promise<Asset> {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), filename);
  form.append("name", filename);
  form.append("type", type);

  const res = await fetch(`${BASE_URL}/api/assets/upload`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to upload asset: ${res.status} ${text}`);
  }
  return res.json() as Promise<Asset>;
}

export async function createJob(templateId: string, narration: { type: "tts"; text: string } | { type: "audio"; assetId: string }, imageAssetIds: string[]): Promise<Job> {
  const res = await fetch(`${BASE_URL}/api/jobs`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      templateId,
      narration,
      mediaPoolOverrides: [{ nodeId: "scene-pool", assetIds: imageAssetIds }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create job: ${res.status} ${text}`);
  }
  return res.json() as Promise<Job>;
}

export async function getJob(jobId: string): Promise<Job> {
  const res = await fetch(`${BASE_URL}/api/jobs/${jobId}`, { headers });
  if (!res.ok) throw new Error(`Failed to get job: ${res.status}`);
  return res.json() as Promise<Job>;
}

export async function getDownloadUrl(jobId: string): Promise<string> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(`${BASE_URL}/api/jobs/${jobId}/download`, { headers });
    if (res.status === 429) {
      await Bun.sleep(15_000 * attempt);
      continue;
    }
    if (!res.ok) throw new Error(`Failed to get download URL: ${res.status}`);
    const data = await res.json() as { url: string };
    return data.url;
  }
  throw new Error("Failed to get download URL after retries (rate limited)");
}
