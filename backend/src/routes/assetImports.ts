import { Elysia } from "elysia";
import { eq, and, lt, ne, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../auth/session";
import { database } from "../database";
import { assetImportBatches, type ImportSegment } from "../database/schema/assetImports";
import { assets } from "../database/schema/assets";
import { storageClient as minio, presignClient, BUCKET_ASSETS } from "@nyx/shared";
import { startImportSchema, fallbackImportSchema, confirmImportSchema } from "../lib/schemas";
import { ChunkedUploadError, startChunkedUpload, writeUploadChunk, completeChunkedUpload } from "../lib/chunkedUpload";
import { assetImportQueue } from "../lib/queue";

interface UploadMeta {
  name: string;
}

const ABANDONED_BATCH_DAYS = 7;

async function removeBatchObjects(batch: { sourceStorageKey: string; segments: ImportSegment[] }) {
  await minio.removeObject(BUCKET_ASSETS, batch.sourceStorageKey).catch(() => {});
  await Promise.all(
    batch.segments.flatMap((s) => [
      minio.removeObject(BUCKET_ASSETS, s.clipStorageKey).catch(() => {}),
      minio.removeObject(BUCKET_ASSETS, s.thumbnailKey).catch(() => {}),
    ]),
  );
}

// ponytail: lazy cleanup — sem scheduler dedicado, só varre quando alguém começa um novo upload.
async function cleanupAbandonedBatches(userId: string) {
  const cutoff = new Date(Date.now() - ABANDONED_BATCH_DAYS * 24 * 60 * 60 * 1000);
  const stale = await database
    .select()
    .from(assetImportBatches)
    .where(and(eq(assetImportBatches.userId, userId), ne(assetImportBatches.status, "done"), lt(assetImportBatches.createdAt, cutoff)));

  for (const batch of stale) {
    await removeBatchObjects(batch);
  }
  if (stale.length > 0) {
    await database.delete(assetImportBatches).where(inArray(assetImportBatches.id, stale.map((b) => b.id)));
  }
}

export const assetImportRoutes = new Elysia({ prefix: "/api/asset-imports" })
  .use(requireAuth)

  .post("/upload/start", async ({ body, session, set }) => {
    const parsed = startImportSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "invalid fields", details: parsed.error.flatten() };
    }

    await cleanupAbandonedBatches(session.user.id);

    const batchId = await startChunkedUpload<UploadMeta>({ userId: session.user.id, name: parsed.data.name });
    return { batchId };
  })

  .put("/upload/:batchId/chunk", async ({ params, query, body, session, set }) => {
    const index = Number((query as Record<string, string>).index);
    if (!Number.isInteger(index) || index < 0) {
      set.status = 400;
      return { error: "invalid chunk params" };
    }

    try {
      await writeUploadChunk(params.batchId, session.user.id, index, Buffer.from(body as ArrayBuffer));
    } catch (err) {
      if (err instanceof ChunkedUploadError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "failed to write chunk", detail: String(err) };
    }

    return { received: index };
  })

  .post("/upload/:batchId/complete", async ({ params, body, session, set }) => {
    const b = body as Record<string, unknown>;
    const totalChunks = Number(b.totalChunks);
    const totalSize = Number(b.totalSize);
    if (!Number.isInteger(totalChunks) || totalChunks <= 0 || !Number.isFinite(totalSize)) {
      set.status = 400;
      return { error: "invalid fields" };
    }

    const { batchId } = params;
    const userId = session.user.id;

    let meta: UploadMeta;
    let storageKey: string;
    try {
      ({ meta, storageKey } = await completeChunkedUpload<UploadMeta>(
        batchId,
        userId,
        totalChunks,
        totalSize,
        BUCKET_ASSETS,
        (m) => `${userId}/imports/${batchId}/source-${m.name}`,
      ));
    } catch (err) {
      if (err instanceof ChunkedUploadError) {
        set.status = err.status;
        return { error: err.message };
      }
      throw err;
    }

    await database.insert(assetImportBatches).values({
      id: batchId,
      userId,
      sourceName: meta.name,
      sourceStorageKey: storageKey,
      status: "detecting",
    });

    await assetImportQueue.add("detect", { batchId });

    set.status = 201;
    return { batchId, status: "detecting" };
  })

  .get("/", async ({ session }) => {
    // "failed" entra aqui também: se sobrou algum corte pronto antes de falhar, o usuário
    // ainda pode confirmar (ver botão "ver progresso" no front) — só falta status novo trabalho.
    const rows = await database
      .select()
      .from(assetImportBatches)
      .where(
        and(
          eq(assetImportBatches.userId, session.user.id),
          inArray(assetImportBatches.status, ["detecting", "awaiting_fallback_choice", "awaiting_review", "failed"]),
        ),
      );
    return { data: rows };
  })

  .get("/:id", async ({ params, session, set }) => {
    const [batch] = await database
      .select()
      .from(assetImportBatches)
      .where(and(eq(assetImportBatches.id, params.id), eq(assetImportBatches.userId, session.user.id)))
      .limit(1);

    if (!batch) {
      set.status = 404;
      return { error: "import batch not found" };
    }

    const segments = await Promise.all(
      batch.segments.map(async (s) => ({
        ...s,
        thumbnailUrl: await presignClient.presignedGetObject(BUCKET_ASSETS, s.thumbnailKey, 3600),
      })),
    );

    return { ...batch, segments };
  })

  .post("/:id/fallback", async ({ params, body, session, set }) => {
    const parsed = fallbackImportSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "invalid fields", details: parsed.error.flatten() };
    }

    const [batch] = await database
      .select()
      .from(assetImportBatches)
      .where(and(eq(assetImportBatches.id, params.id), eq(assetImportBatches.userId, session.user.id)))
      .limit(1);

    if (!batch) {
      set.status = 404;
      return { error: "import batch not found" };
    }
    if (batch.status !== "awaiting_fallback_choice") {
      set.status = 409;
      return { error: `lote está em '${batch.status}', esperava 'awaiting_fallback_choice'` };
    }

    await database.update(assetImportBatches).set({ status: "detecting" }).where(eq(assetImportBatches.id, params.id));
    await assetImportQueue.add("detect", { batchId: params.id, fallbackMode: parsed.data.mode });

    return { status: "detecting" };
  })

  .post("/:id/confirm", async ({ params, body, session, set }) => {
    const parsed = confirmImportSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "invalid fields", details: parsed.error.flatten() };
    }

    const userId = session.user.id;
    const [batch] = await database
      .select()
      .from(assetImportBatches)
      .where(and(eq(assetImportBatches.id, params.id), eq(assetImportBatches.userId, userId)))
      .limit(1);

    if (!batch) {
      set.status = 404;
      return { error: "import batch not found" };
    }
    // done/discarded são terminais de verdade. "detecting" e "failed" também podem confirmar —
    // é o que permite salvar cortes prontos enquanto o resto ainda processa, ou recuperar o
    // que deu certo antes de uma falha no meio do lote.
    if (batch.status === "done" || batch.status === "discarded") {
      set.status = 409;
      return { error: `lote está em '${batch.status}', não é mais possível confirmar` };
    }

    const selected = new Set(parsed.data.selectedIndexes);
    const invalid = [...selected].filter((i) => !batch.segments.some((s) => s.index === i));
    if (invalid.length > 0) {
      set.status = 400;
      return { error: `índices inválidos: ${invalid.join(", ")}` };
    }

    const toKeep = batch.segments.filter((s) => selected.has(s.index));

    if (toKeep.length > 0) {
      await database.insert(assets).values(
        toKeep.map((s) => ({
          userId,
          name: parsed.data.names?.[s.index] ?? s.name ?? `${batch.sourceName} — parte ${s.index}`,
          type: "video" as const,
          storageKey: s.clipStorageKey,
          importBatchId: batch.id,
        })),
      );
    }

    const stillProcessing = batch.status === "detecting";

    if (stillProcessing) {
      // Confirmação parcial: só tira os confirmados da lista, de forma atômica (o worker pode
      // estar adicionando outro corte nesse exato momento — um "lê tudo e regrava" perderia
      // esse update). Os não selecionados ficam guardados pra decidir numa próxima chamada.
      // drizzle expande array em params separados (vira tupla, não array do postgres) —
      // os índices já passaram pelo Zod como inteiros, seguro montar o ARRAY[...] direto.
      await database
        .update(assetImportBatches)
        .set({
          segments: sql`(
            select coalesce(jsonb_agg(elem), '[]'::jsonb)
            from jsonb_array_elements(${assetImportBatches.segments}) elem
            where not ((elem->>'index')::int = any(array[${sql.raw([...selected].join(","))}]))
          )`,
        })
        .where(eq(assetImportBatches.id, batch.id));
    } else {
      // Não vem mais nada (awaiting_review ou failed) — decide os não selecionados agora.
      const toDrop = batch.segments.filter((s) => !selected.has(s.index));
      await Promise.all(
        toDrop.flatMap((s) => [
          minio.removeObject(BUCKET_ASSETS, s.clipStorageKey).catch(() => {}),
          minio.removeObject(BUCKET_ASSETS, s.thumbnailKey).catch(() => {}),
        ]),
      );
      await minio.removeObject(BUCKET_ASSETS, batch.sourceStorageKey).catch(() => {});
      await database
        .update(assetImportBatches)
        .set({ status: "done", segments: [], completedAt: new Date() })
        .where(eq(assetImportBatches.id, params.id));
    }

    return { status: stillProcessing ? "detecting" : "done", imported: toKeep.length };
  })

  .delete("/:id", async ({ params, session, set }) => {
    const [batch] = await database
      .select()
      .from(assetImportBatches)
      .where(and(eq(assetImportBatches.id, params.id), eq(assetImportBatches.userId, session.user.id)))
      .limit(1);

    if (!batch) {
      set.status = 404;
      return { error: "import batch not found" };
    }
    if (batch.status === "done") {
      set.status = 409;
      return { error: "lote já confirmado não pode ser descartado" };
    }

    await removeBatchObjects(batch);
    await database.delete(assetImportBatches).where(eq(assetImportBatches.id, params.id));

    return { deleted: true };
  });
