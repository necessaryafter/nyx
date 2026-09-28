import { Elysia } from "elysia";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { eq, and, count, desc, ilike } from "drizzle-orm";
import { rateLimit } from "elysia-rate-limit";
import { requireAuth } from "../auth/session";
import { database } from "../database";
import { assets } from "../database/schema/assets";
import { storageClient as minio, presignClient, BUCKET_ASSETS } from "@nyx/shared";
import { uploadAssetSchema, paginationSchema } from "../lib/schemas";
import { ChunkedUploadError, startChunkedUpload, writeUploadChunk, completeChunkedUpload } from "../lib/chunkedUpload";

interface UploadMeta {
  name: string;
  type: "video" | "audio" | "text" | "image";
}

export const assetRoutes = new Elysia({ prefix: "/api/assets" })
  .use(requireAuth)

  // ── Chunked multipart upload (no tight rate limit — chunks are small) ──────

  .post("/upload/multipart/start", async ({ body, session, set }) => {
    const b = body as Record<string, unknown>;
    const parsed = uploadAssetSchema.safeParse({ name: b.name, type: b.type });
    if (!parsed.success) {
      set.status = 400;
      return { error: "invalid fields", details: parsed.error.flatten() };
    }

    const assetId = await startChunkedUpload<UploadMeta>({
      userId: session.user.id,
      name: parsed.data.name,
      type: parsed.data.type,
    });

    return { assetId };
  })

  .put("/upload/multipart/:assetId/chunk", async ({ params, query, body, session, set }) => {
    const index = Number((query as Record<string, string>).index);
    const total = Number((query as Record<string, string>).total);
    if (!Number.isInteger(index) || !Number.isInteger(total) || index < 0 || total <= 0) {
      set.status = 400;
      return { error: "invalid chunk params" };
    }

    try {
      await writeUploadChunk(params.assetId, session.user.id, index, Buffer.from(body as ArrayBuffer));
    } catch (err) {
      if (err instanceof ChunkedUploadError) {
        set.status = err.status;
        return { error: err.message };
      }
      console.error(`[chunk upload] failed writing chunk ${index} for ${params.assetId}:`, err);
      set.status = 500;
      return { error: "failed to write chunk", detail: String(err) };
    }

    return { received: index };
  })

  .post("/upload/multipart/:assetId/complete", async ({ params, body, session, set }) => {
    const b = body as Record<string, unknown>;
    const totalChunks = Number(b.totalChunks);
    const totalSize = Number(b.totalSize);
    if (!Number.isInteger(totalChunks) || totalChunks <= 0 || !Number.isFinite(totalSize)) {
      set.status = 400;
      return { error: "invalid fields" };
    }

    const { assetId } = params;
    const userId = session.user.id;

    let meta: UploadMeta;
    let storageKey: string;
    try {
      ({ meta, storageKey } = await completeChunkedUpload<UploadMeta>(
        assetId,
        userId,
        totalChunks,
        totalSize,
        BUCKET_ASSETS,
        (m) => `${userId}/${assetId}/${m.name}`,
      ));
    } catch (err) {
      if (err instanceof ChunkedUploadError) {
        set.status = err.status;
        return { error: err.message };
      }
      throw err;
    }

    const [row] = await database
      .insert(assets)
      .values({ id: assetId, userId, name: meta.name, type: meta.type, storageKey, sizeBytes: totalSize })
      .returning();

    set.status = 201;
    return row;
  })

  // ── Single-file upload (20 req/min) ─────────────────────────────────────
  .use(rateLimit({ max: 20, duration: 60_000, scoping: "scoped" }))
  .post("/upload", async ({ body, session, set }) => {
    const formData = body as Record<string, unknown>;
    const file = formData.file;

    if (!(file instanceof Blob)) {
      set.status = 400;
      return { error: "file is required" };
    }

    const parsed = uploadAssetSchema.safeParse({
      name: formData.name,
      type: formData.type,
    });

    if (!parsed.success) {
      set.status = 400;
      return { error: "invalid fields", details: parsed.error.flatten() };
    }

    const { name, type } = parsed.data;
    const userId = session.user.id;
    const assetId = randomUUID();
    const storageKey = `${userId}/${assetId}/${name}`;
    const stream = Readable.from(file.stream() as AsyncIterable<Uint8Array>);

    await minio.putObject(BUCKET_ASSETS, storageKey, stream, file.size);

    const [row] = await database
      .insert(assets)
      .values({
        id: assetId,
        userId,
        name,
        type,
        storageKey,
        sizeBytes: file.size,
      })
      .returning();

    set.status = 201;
    return row;
  })

  // List user assets (paginated, filterable by type and search)
  .get("/", async ({ session, query, set }) => {
    const pagination = paginationSchema.safeParse(query);
    if (!pagination.success) {
      set.status = 400;
      return { error: "invalid pagination", details: pagination.error.flatten() };
    }
    const { limit, offset, type, search } = pagination.data;
    const userId = session.user.id;

    const conditions = [eq(assets.userId, userId)];
    if (type) conditions.push(eq(assets.type, type));
    if (search) conditions.push(ilike(assets.name, `%${search}%`));
    const where = and(...conditions);

    const [rows, [total]] = await Promise.all([
      database
        .select()
        .from(assets)
        .where(where)
        .orderBy(desc(assets.createdAt))
        .limit(limit)
        .offset(offset),
      database
        .select({ count: count() })
        .from(assets)
        .where(where),
    ]);

    return { data: rows, total: total!.count, limit, offset };
  })

  // Get presigned URL for an asset
  .get("/:id/url", async ({ params, session, set }) => {
    const [row] = await database
      .select()
      .from(assets)
      .where(and(eq(assets.id, params.id), eq(assets.userId, session.user.id)))
      .limit(1);

    if (!row) {
      set.status = 404;
      return { error: "asset not found" };
    }

    const url = await presignClient.presignedGetObject(BUCKET_ASSETS, row.storageKey, 3600);
    return { url };
  })

  // Delete asset
  .delete("/:id", async ({ params, session, set }) => {
    const [row] = await database
      .select()
      .from(assets)
      .where(and(eq(assets.id, params.id), eq(assets.userId, session.user.id)))
      .limit(1);

    if (!row) {
      set.status = 404;
      return { error: "asset not found" };
    }

    await minio.removeObject(BUCKET_ASSETS, row.storageKey);
    await database.delete(assets).where(eq(assets.id, params.id));

    return { deleted: true };
  });
