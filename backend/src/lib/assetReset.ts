import { eq, inArray } from "drizzle-orm";
import { storageClient as minio, BUCKET_ASSETS } from "@nyx/shared";
import { database } from "../database";
import { assets } from "../database/schema/assets";
import { templates } from "../database/schema/templates";
import { schedulers } from "../database/schema/schedulers";

/**
 * Tira de um JSON qualquer (grafo de template) as referências aos assets removidos:
 * `assetIds` perde os ids apagados e `assetId` apagado vira null. Devolve cópia nova.
 * `removed = "all"` limpa toda referência, inclusive as órfãs de assets apagados antes.
 */
export function pruneAssetRefs<T>(value: T, removed: ReadonlySet<string> | "all"): T {
  const gone = (id: unknown) => removed === "all" || removed.has(String(id));
  if (Array.isArray(value)) return value.map((v) => pruneAssetRefs(v, removed)) as T;
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (key === "assetIds" && Array.isArray(v)) out[key] = v.filter((id) => !gone(id));
    else if ((key === "assetId" || key === "avatarAssetId") && typeof v === "string" && gone(v)) out[key] = null;
    else out[key] = pruneAssetRefs(v, removed);
  }
  return out as T;
}

/**
 * Apaga TODOS os assets do usuário (arquivo no MinIO + linha) e limpa TODA referência a asset em
 * schedulers e templates (sem assets, qualquer id que sobrar é órfão e quebraria o render com
 * "asset <id> not found").
 */
export async function resetUserAssets(userId: string): Promise<{ deleted: number; schedulersUpdated: number; templatesUpdated: number }> {
  const rows = await database.select({ id: assets.id, storageKey: assets.storageKey }).from(assets).where(eq(assets.userId, userId));

  let schedulersUpdated = 0;
  for (const s of await database.select().from(schedulers).where(eq(schedulers.userId, userId))) {
    if (s.assetIds.length === 0 && s.musicAssetIds.length === 0) continue;
    await database.update(schedulers).set({ assetIds: [], musicAssetIds: [] }).where(eq(schedulers.id, s.id));
    schedulersUpdated++;
  }

  let templatesUpdated = 0;
  for (const t of await database.select().from(templates).where(eq(templates.userId, userId))) {
    const graph = pruneAssetRefs(t.graph, "all");
    if (JSON.stringify(graph) === JSON.stringify(t.graph)) continue;
    await database.update(templates).set({ graph }).where(eq(templates.id, t.id));
    templatesUpdated++;
  }

  for (const r of rows) await minio.removeObject(BUCKET_ASSETS, r.storageKey).catch(() => {}); // objeto já ausente não trava o reset
  if (rows.length > 0) await database.delete(assets).where(inArray(assets.id, rows.map((r) => r.id)));
  return { deleted: rows.length, schedulersUpdated, templatesUpdated };
}
