import { Elysia } from "elysia";
import { randomUUID } from "crypto";
import { eq, and, count, desc, like, ilike } from "drizzle-orm";
import { rateLimit } from "elysia-rate-limit";
import { requireAuth } from "../auth/session";
import { database } from "../database";
import { assets } from "../database/schema/assets";
import { storageClient as minio, BUCKET_ASSETS } from "@nyx/shared";
import { uploadAssetSchema, paginationSchema } from "../lib/schemas";

export const assetRoutes = new Elysia({ prefix: "/api/assets" })
  .use(requireAuth)

  // Upload asset (20 req/min)
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
    const buffer = Buffer.from(await file.arrayBuffer());

    await minio.putObject(BUCKET_ASSETS, storageKey, buffer, buffer.length);

    const [row] = await database
      .insert(assets)
      .values({
        id: assetId,
        userId,
        name,
        type,
        storageKey,
        sizeBytes: buffer.length,
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

    const url = await minio.presignedGetObject(BUCKET_ASSETS, row.storageKey, 3600);
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
