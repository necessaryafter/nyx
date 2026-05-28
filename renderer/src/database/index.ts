import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray, and } from "drizzle-orm";
import postgres from "postgres";
import { jobs, assets, integrations } from "./schema";
import type { Graph } from "../graph";

export { jobs } from "./schema";

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema: { jobs, assets, integrations } });

export async function fetchJob(jobId: string) {
  const row = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (row.length === 0) throw new Error(`job ${jobId} not found`);
  return row[0]! as typeof row[0] & { graph: Graph };
}

export async function markAudioReady(jobId: string, audioKey: string, sceneSlots: unknown) {
  await db
    .update(jobs)
    .set({ status: "audio_ready", audioKey, sceneSlots })
    .where(eq(jobs.id, jobId));
}

export async function markDone(jobId: string, videoKey: string, durationSeconds?: number) {
  await db
    .update(jobs)
    .set({ status: "done", videoKey, durationSeconds, completedAt: new Date() })
    .where(eq(jobs.id, jobId));
}

export async function markFailed(jobId: string, error: string) {
  await db
    .update(jobs)
    .set({ status: "failed", error, completedAt: new Date() })
    .where(eq(jobs.id, jobId));
}

/**
 * Resolve asset UUIDs → MinIO storageKeys.
 * Returns a map of assetId → storageKey for all found assets.
 */
export async function resolveAssetKeys(assetIds: string[]): Promise<Map<string, string>> {
  if (assetIds.length === 0) return new Map();
  const rows = await db.select({ id: assets.id, storageKey: assets.storageKey }).from(assets).where(inArray(assets.id, assetIds));
  return new Map(rows.map((r) => [r.id, r.storageKey]));
}

export async function fetchUserIntegration(userId: string, provider: string) {
  const rows = await db
    .select({ encryptedApiKey: integrations.encryptedApiKey })
    .from(integrations)
    .where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)))
    .limit(1);
    
  return rows[0] ?? null;
}
