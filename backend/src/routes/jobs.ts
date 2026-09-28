import { Elysia } from "elysia";
import { eq, and, desc, count } from "drizzle-orm";
import { rateLimit } from "elysia-rate-limit";
import { requireAuth } from "../auth/session";
import { database } from "../database";
import { jobs } from "../database/schema/jobs";
import { templates } from "../database/schema/templates";
import { creditTransactions } from "../database/schema/credits";
import { storageClient as minio, presignClient, BUCKET_ASSETS, BUCKET_VIDEOS } from "@nyx/shared";
import { renderQueue } from "../lib/queue";
import {
  createDraftJobSchema,
  startAudioSchema,
  updateSlotsSchema,
  paginationSchema,
  type SceneSlot,
} from "../lib/schemas";
import { HttpError, createDraftJob, loadOwnedTemplate, startAudio, startRender } from "../lib/jobs.service";

const STAGED_STATUSES = new Set(["draft", "audio_processing", "audio_ready", "ready"]);

export const jobRoutes = new Elysia({ prefix: "/api/jobs" })
  .use(requireAuth)
  .use(rateLimit({ max: 20, duration: 60_000, scoping: "scoped" }))

  // ── T-07: Cria job em draft (fluxo staged) ──
  .post("/draft", async ({ body, session, set }) => {
    const parsed = createDraftJobSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "invalid fields", details: parsed.error.flatten() };
    }

    try {
      const template = await loadOwnedTemplate(session.user.id, parsed.data.templateId);
      const job = await createDraftJob(session.user.id, template);
      set.status = 201;
      return job;
    } catch (err) {
      if (err instanceof HttpError) { set.status = err.status; return err.body; }
      throw err;
    }
  })

  // ── T-08: Enfileira geração de áudio (etapa 2) ──
  .post("/:id/audio", async ({ params, body, session, set }) => {
    const parsed = startAudioSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "invalid fields", details: parsed.error.flatten() };
    }

    const userId = session.user.id;

    const [job] = await database
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, params.id), eq(jobs.userId, userId)))
      .limit(1);

    if (!job) {
      set.status = 404;
      return { error: "job not found" };
    }

    try {
      await startAudio(userId, job, parsed.data.narration);
      return { status: "audio_processing" };
    } catch (err) {
      if (err instanceof HttpError) { set.status = err.status; return err.body; }
      throw err;
    }
  })

  // ── T-10: Atualiza slots de mídia (etapa 3) ──
  .patch("/:id/slots", async ({ params, body, session, set }) => {
    const parsed = updateSlotsSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "invalid fields", details: parsed.error.flatten() };
    }

    const userId = session.user.id;

    const [job] = await database
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, params.id), eq(jobs.userId, userId)))
      .limit(1);

    if (!job) {
      set.status = 404;
      return { error: "job not found" };
    }

    if (job.status !== "audio_ready") {
      set.status = 409;
      return { error: "job must be in audio_ready status", current: job.status };
    }

    const currentSlots = (job.sceneSlots ?? []) as SceneSlot[];

    // Merge: aplica os slots recebidos sobre os existentes
    const merged = currentSlots.map((existing) => {
      const update = parsed.data.slots.find((s) => s.index === existing.index);
      if (!update) return existing;
      return {
        ...existing,
        assetId: update.assetId !== undefined ? update.assetId : existing.assetId,
        startMs: update.startMs ?? existing.startMs,
        endMs: update.endMs ?? existing.endMs,
      };
    });

    const allFilled = merged.length > 0 && merged.every((s) => s.assetId !== null);
    const newStatus = allFilled ? "ready" : "audio_ready";

    await database
      .update(jobs)
      .set({ sceneSlots: merged, status: newStatus })
      .where(eq(jobs.id, job.id));

    return { status: newStatus, slots: merged };
  })

  // ── T-11: Enfileira renderização (etapa 4) ──
  .post("/:id/render", async ({ params, session, set }) => {
    const userId = session.user.id;

    const [job] = await database
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, params.id), eq(jobs.userId, userId)))
      .limit(1);

    if (!job) {
      set.status = 404;
      return { error: "job not found" };
    }

    try {
      const { creditsCharged } = await startRender(userId, job);
      return { status: "rendering", creditsCharged };
    } catch (err) {
      if (err instanceof HttpError) { set.status = err.status; return err.body; }
      throw err;
    }
  })

  // ── Reexecuta um job que falhou ──
  .post("/:id/retry", async ({ params, session, set }) => {
    const userId = session.user.id;

    const [job] = await database
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, params.id), eq(jobs.userId, userId)))
      .limit(1);

    if (!job) {
      set.status = 404;
      return { error: "job not found" };
    }

    if (job.status !== "failed") {
      set.status = 409;
      return { error: "only failed jobs can be retried", current: job.status };
    }

    // Falhou durante a renderização — áudio já estava pronto, basta re-enfileirar
    if (job.audioKey) {
      await database
        .update(jobs)
        .set({ status: "rendering", error: null })
        .where(eq(jobs.id, job.id));
      await renderQueue.add("render", { jobId: job.id });
      return { status: "rendering" };
    }

    // Falhou durante o processamento de áudio — volta para draft e reembolsa TTS se cobrado
    const [ttsTx] = await database
      .select({ amount: creditTransactions.amount })
      .from(creditTransactions)
      .where(and(eq(creditTransactions.jobId, job.id), eq(creditTransactions.reason, "tts")))
      .limit(1);

    if (ttsTx) {
      await database.insert(creditTransactions).values({
        userId,
        amount: Math.abs(ttsTx.amount),
        reason: "refund",
        jobId: job.id,
      });
    }

    await database
      .update(jobs)
      .set({ status: "draft", error: null })
      .where(eq(jobs.id, job.id));

    return { status: "draft" };
  })

  // ── T-12: Descarta job em andamento ──
  .delete("/:id", async ({ params, session, set }) => {
    const userId = session.user.id;

    const [job] = await database
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, params.id), eq(jobs.userId, userId)))
      .limit(1);

    if (!job) {
      set.status = 404;
      return { error: "job not found" };
    }

    if (!STAGED_STATUSES.has(job.status)) {
      set.status = 409;
      return { error: "only draft/in-progress jobs can be deleted", current: job.status };
    }

    // Reembolsa créditos de TTS se foram debitados
    const ttsTransaction = await database
      .select({ amount: creditTransactions.amount })
      .from(creditTransactions)
      .where(and(eq(creditTransactions.jobId, job.id), eq(creditTransactions.reason, "tts")))
      .limit(1);

    if (ttsTransaction.length > 0) {
      const refundAmount = Math.abs(ttsTransaction[0]!.amount);
      await database.insert(creditTransactions).values({
        userId,
        amount: refundAmount,
        reason: "refund",
        jobId: job.id,
      });
    }

    // Deleta áudio gerado do MinIO (se existir)
    if (job.audioKey) {
      await minio.removeObject(BUCKET_ASSETS, job.audioKey).catch(() => {});
    }

    await database.delete(jobs).where(eq(jobs.id, job.id));

    set.status = 204;
    return;
  })

  // ── GET /api/jobs — Lista jobs do usuário ──
  .get("/", async ({ session, query, set }) => {
    const pagination = paginationSchema.safeParse(query);
    if (!pagination.success) {
      set.status = 400;
      return { error: "invalid pagination", details: pagination.error.flatten() };
    }
    const { limit, offset } = pagination.data;
    const userId = session.user.id;

    const [rows, [total]] = await Promise.all([
      database
        .select({
          id: jobs.id,
          status: jobs.status,
          templateId: jobs.templateId,
          templateName: templates.name,
          videoKey: jobs.videoKey,
          durationSeconds: jobs.durationSeconds,
          creditsCharged: jobs.creditsCharged,
          error: jobs.error,
          createdAt: jobs.createdAt,
          completedAt: jobs.completedAt,
        })
        .from(jobs)
        .leftJoin(templates, eq(jobs.templateId, templates.id))
        .where(eq(jobs.userId, userId))
        .orderBy(desc(jobs.createdAt))
        .limit(limit)
        .offset(offset),
      database
        .select({ count: count() })
        .from(jobs)
        .where(eq(jobs.userId, userId)),
    ]);

    return { data: rows, total: total!.count, limit, offset };
  })

  // ── GET /api/jobs/:id ──
  .get("/:id", async ({ params, session, set }) => {
    const [row] = await database
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, params.id), eq(jobs.userId, session.user.id)))
      .limit(1);

    if (!row) {
      set.status = 404;
      return { error: "job not found" };
    }

    return row;
  })

  // ── GET /api/jobs/:id/download ──
  .get("/:id/download", async ({ params, session, set }) => {
    const [row] = await database
      .select({ status: jobs.status, videoKey: jobs.videoKey })
      .from(jobs)
      .where(and(eq(jobs.id, params.id), eq(jobs.userId, session.user.id)))
      .limit(1);

    if (!row) {
      set.status = 404;
      return { error: "job not found" };
    }

    if (row.status !== "done" || !row.videoKey) {
      set.status = 400;
      return { error: "video not ready" };
    }

    const url = await presignClient.presignedGetObject(BUCKET_VIDEOS, row.videoKey, 3600);
    return { url };
  });
