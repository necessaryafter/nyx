import { Elysia } from "elysia";
import { eq, and, desc, count, sum } from "drizzle-orm";
import { rateLimit } from "elysia-rate-limit";
import { requireAuth } from "../auth/session";
import { database } from "../database";
import { jobs } from "../database/schema/jobs";
import { templates } from "../database/schema/templates";
import { assets } from "../database/schema/assets";
import { creditTransactions } from "../database/schema/credits";
import { storageClient as minio, BUCKET_ASSETS, BUCKET_VIDEOS } from "@nyx/shared";
import { renderQueue, audioQueue } from "../lib/queue";
import {
  createDraftJobSchema,
  startAudioSchema,
  updateSlotsSchema,
  createJobSchema,
  graphSchema,
  validateGraphStructure,
  paginationSchema,
  narrationSchema,
  type GraphInput,
  type SceneSlot,
} from "../lib/schemas";
import { RENDER_CREDITS_PER_MIN, TTS_CREDITS_PER_MIN } from "../lib/credits";
import { z } from "zod";

interface AudioJobData {
  jobId: string;
  narration:
    | { type: "tts"; text: string; provider: "talkify"; voice?: string; speed?: number }
    | { type: "audio"; assetStorageKey: string };
}

type Narration = z.infer<typeof narrationSchema>;

function injectNarration(graph: GraphInput, narration: Narration): GraphInput {
  const nodes = graph.nodes.map((node) => {
    if (node.type !== "TTS") return node;

    if (narration.type === "tts") {
      return { ...node, config: { ...node.config, text: narration.text } };
    }
    return { ...node, config: { ...node.config, provider: "custom" as const, voice: narration.assetId } };
  });

  return { ...graph, nodes };
}

/** Injeta o audioKey pré-computado no TTS node como provider=precomputed */
function injectPrecomputedAudio(graph: GraphInput, audioKey: string): GraphInput {
  const nodes = graph.nodes.map((node) => {
    if (node.type !== "TTS") return node;
    return { ...node, config: { ...node.config, provider: "precomputed" as const, voice: audioKey } };
  });
  return { ...graph, nodes };
}

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

    const userId = session.user.id;

    const [template] = await database
      .select()
      .from(templates)
      .where(and(eq(templates.id, parsed.data.templateId), eq(templates.userId, userId)))
      .limit(1);

    if (!template) {
      set.status = 404;
      return { error: "template not found" };
    }

    const graphParsed = graphSchema.safeParse(template.graph);
    if (!graphParsed.success) {
      set.status = 400;
      return { error: "invalid graph in template", details: graphParsed.error.flatten() };
    }

    const [job] = await database
      .insert(jobs)
      .values({
        userId,
        templateId: template.id,
        status: "draft",
        graph: graphParsed.data,
      })
      .returning();

    set.status = 201;
    return job!;
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

    if (job.status !== "draft") {
      set.status = 409;
      return { error: "job must be in draft status", current: job.status };
    }

    // Debita créditos de TTS se provider externo
    const { narration } = parsed.data;
    const isExternalTTS = narration.type === "tts";
    const ttsCredits = isExternalTTS ? TTS_CREDITS_PER_MIN : 0;

    if (ttsCredits > 0) {
      const [balanceResult] = await database
        .select({ total: sum(creditTransactions.amount) })
        .from(creditTransactions)
        .where(eq(creditTransactions.userId, userId));

      const balance = Number(balanceResult?.total ?? 0);
      if (balance < ttsCredits) {
        set.status = 402;
        return { error: "insufficient credits", required: ttsCredits, balance };
      }

      await database.insert(creditTransactions).values({
        userId,
        amount: -ttsCredits,
        reason: "tts",
        jobId: job.id,
      });
    }

    // Atualiza status → audio_processing
    await database
      .update(jobs)
      .set({ status: "audio_processing" })
      .where(eq(jobs.id, job.id));

    // Resolve storageKey do asset de áudio (se type=audio)
    let audioJobNarration: AudioJobData["narration"];
    if (narration.type === "audio") {
      const [asset] = await database
        .select({ storageKey: assets.storageKey })
        .from(assets)
        .where(and(eq(assets.id, narration.assetId), eq(assets.userId, userId)))
        .limit(1);

      if (!asset) {
        set.status = 404;
        return { error: "audio asset not found" };
      }

      audioJobNarration = { type: "audio", assetStorageKey: asset.storageKey };
    } else {
      audioJobNarration = {
        type: "tts",
        text: narration.text,
        provider: narration.provider,
        voice: narration.voice,
        speed: narration.speed,
      };
    }

    await audioQueue.add("audio", { jobId: job.id, narration: audioJobNarration });

    return { status: "audio_processing" };
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

    if (job.status !== "ready") {
      set.status = 409;
      return { error: "job must be in ready status", current: job.status };
    }

    // Injeta audioKey como provider precomputed no grafo
    const graph = job.graph as GraphInput;
    const resolvedGraph = job.audioKey
      ? injectPrecomputedAudio(graph, job.audioKey)
      : graph;

    const structErrors = validateGraphStructure(resolvedGraph);
    if (structErrors.length > 0) {
      set.status = 400;
      return { error: "invalid graph structure", details: structErrors };
    }

    const renderCredits = RENDER_CREDITS_PER_MIN;

    // Verifica saldo + debita + atualiza grafo + enfileira — atomicamente
    let creditsCharged: number;
    try {
      creditsCharged = await database.transaction(async (tx) => {
        const [balanceResult] = await tx
          .select({ total: sum(creditTransactions.amount) })
          .from(creditTransactions)
          .where(eq(creditTransactions.userId, userId));

        const balance = Number(balanceResult?.total ?? 0);
        if (balance < renderCredits) {
          throw { status: 402, balance };
        }

        await tx
          .update(jobs)
          .set({ status: "rendering", graph: resolvedGraph, creditsCharged: renderCredits })
          .where(eq(jobs.id, job.id));

        await tx.insert(creditTransactions).values({
          userId,
          amount: -renderCredits,
          reason: "render",
          jobId: job.id,
        });

        return renderCredits;
      });
    } catch (err: unknown) {
      if (err && typeof err === "object" && "status" in err && (err as Record<string, unknown>).status === 402) {
        set.status = 402;
        const balance = (err as Record<string, unknown>).balance as number;
        return { error: "insufficient credits", required: renderCredits, balance };
      }
      throw err;
    }

    await renderQueue.add("render", { jobId: job.id });

    return { status: "rendering", creditsCharged };
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

  // ── Legado: cria job e enfileira diretamente (quick render) ──
  .post("/", async ({ body, session, set }) => {
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "invalid fields", details: parsed.error.flatten() };
    }

    const userId = session.user.id;

    const [template] = await database
      .select()
      .from(templates)
      .where(and(eq(templates.id, parsed.data.templateId), eq(templates.userId, userId)))
      .limit(1);

    if (!template) {
      set.status = 404;
      return { error: "template not found" };
    }

    const graphParsed = graphSchema.safeParse(template.graph);
    if (!graphParsed.success) {
      set.status = 400;
      return { error: "invalid graph in template", details: graphParsed.error.flatten() };
    }

    const { narration, sceneOverrides, mediaPoolOverrides } = parsed.data;
    let jobGraph = injectNarration(graphParsed.data, narration);

    if (sceneOverrides && sceneOverrides.length > 0) {
      jobGraph = {
        ...jobGraph,
        nodes: jobGraph.nodes.map((node) => {
          if (node.type !== "SceneSlot") return node;
          const override = sceneOverrides.find((o) => o.nodeId === node.id);
          if (!override) return node;
          return { ...node, config: { ...node.config, assetIds: [override.assetId] } };
        }),
      };
    }

    if (mediaPoolOverrides && mediaPoolOverrides.length > 0) {
      jobGraph = {
        ...jobGraph,
        nodes: jobGraph.nodes.map((node) => {
          if (node.type !== "MediaPool") return node;
          const override = mediaPoolOverrides.find((o) => o.nodeId === node.id);
          if (!override) return node;
          return { ...node, config: { ...node.config, assetIds: override.assetIds } };
        }),
      };
    }

    const structErrors = validateGraphStructure(jobGraph);
    if (structErrors.length > 0) {
      set.status = 400;
      return { error: "invalid graph structure", details: structErrors };
    }

    const ttsExternalCount = jobGraph.nodes.filter(
      (n) => n.type === "TTS" && n.config.provider !== "custom",
    ).length;
    const estimatedCredits = RENDER_CREDITS_PER_MIN * 1 + TTS_CREDITS_PER_MIN * ttsExternalCount;

    let job;
    try {
      job = await database.transaction(async (tx) => {
        const [balanceResult] = await tx
          .select({ total: sum(creditTransactions.amount) })
          .from(creditTransactions)
          .where(eq(creditTransactions.userId, userId));

        const balance = Number(balanceResult?.total ?? 0);
        if (balance < estimatedCredits) {
          throw { status: 402, balance };
        }

        const [newJob] = await tx
          .insert(jobs)
          .values({
            userId,
            templateId: template.id,
            graph: jobGraph,
            creditsCharged: estimatedCredits,
          })
          .returning();

        await tx.insert(creditTransactions).values({
          userId,
          amount: -estimatedCredits,
          reason: "render" as const,
          jobId: newJob!.id,
        });

        return newJob!;
      });
    } catch (err: unknown) {
      if (err && typeof err === "object" && "status" in err && (err as Record<string, unknown>).status === 402) {
        set.status = 402;
        const balance = (err as Record<string, unknown>).balance as number;
        return { error: "insufficient credits", required: estimatedCredits, balance };
      }
      throw err;
    }

    await renderQueue.add("render", { jobId: job.id });

    set.status = 201;
    return job;
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

    const url = await minio.presignedGetObject(BUCKET_VIDEOS, row.videoKey, 3600);
    return { url };
  });
