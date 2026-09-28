import { eq, and } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { database } from "../../database";
import { integrations } from "../../database/schema/integrations";
import { decrypt } from "@nyx/shared";

// Modelos que a API do Google aceita mudam com frequência (já quebrou uma vez
// com gemini-2.0-flash/1.5-pro descontinuados). Buscar da própria API em vez
// de manter uma lista fixa no código.
const EXCLUDE_PATTERN = /embedding|tts|image|imagen|nano-banana|robotics|computer-use|antigravity|deep-research|lyria|transcribe/i;

let modelsCache: { key: string; data: Array<{ id: string; label: string }>; expiresAt: number } | null = null;

export function createGemini(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

/** Integração do usuário → env do servidor (fallback de dev) → null. */
export async function resolveGeminiKey(userId: string): Promise<string | null> {
  const [row] = await database
    .select({ encryptedApiKey: integrations.encryptedApiKey })
    .from(integrations)
    .where(and(eq(integrations.userId, userId), eq(integrations.provider, "gemini")))
    .limit(1);

  if (row) return decrypt(row.encryptedApiKey);
  return process.env.GOOGLE_AI_STUDIO_KEY ?? null;
}

export async function validateGeminiKey(apiKey: string): Promise<boolean> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  return res.ok;
}

function toLabel(id: string): string {
  // "gemini-3.1-flash-lite" -> "Gemini 3.1 Flash Lite"
  return id
    .split("-")
    .map((part) => (/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

export async function listGeminiModels(apiKey: string): Promise<Array<{ id: string; label: string }>> {
  const now = Date.now();
  if (modelsCache && modelsCache.key === apiKey && modelsCache.expiresAt > now) {
    return modelsCache.data;
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (!res.ok) throw new Error(`Gemini API error (${res.status})`);

  const body = (await res.json()) as {
    models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
  };

  const data = (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((id) => id.startsWith("gemini-") && !EXCLUDE_PATTERN.test(id))
    .map((id) => ({ id, label: toLabel(id) }));

  modelsCache = { key: apiKey, data, expiresAt: now + 60 * 60 * 1000 };
  return data;
}
