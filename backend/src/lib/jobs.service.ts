import { eq, and, sum } from "drizzle-orm";
import { database } from "../database";
import { jobs } from "../database/schema/jobs";
import { templates } from "../database/schema/templates";
import { assets } from "../database/schema/assets";
import { creditTransactions } from "../database/schema/credits";
import { renderQueue, audioQueue } from "./queue";
import { RENDER_CREDITS_PER_MIN, TTS_CREDITS_PER_MIN } from "./credits";
import type { z } from "zod";
import { graphSchema, validateGraphStructure, startAudioSchema, type GraphInput } from "./schemas";

/**
 * Extraído de routes/jobs.ts pro job-scheduler poder criar/tocar jobs de dentro
 * do worker sem passar por HTTP. As rotas continuam com o mesmo contrato — só
 * chamam essas funções em vez de repetir a lógica inline.
 */
export class HttpError extends Error {
  constructor(public status: number, public body: Record<string, unknown>) {
    super(typeof body.error === "string" ? body.error : "HttpError");
  }
}

type JobRow = typeof jobs.$inferSelect;

interface AudioJobData {
  jobId: string;
  narration:
    | Extract<StartAudioNarration, { type: "tts" }>
    | { type: "audio"; assetStorageKey: string };
}

export type StartAudioNarration = z.infer<typeof startAudioSchema>["narration"];

/** Injeta o audioKey pré-computado no NarrationSource como provider=precomputed. */
export function injectPrecomputedAudio(graph: GraphInput, audioKey: string): GraphInput {
  const nodes = graph.nodes.map((node) => {
    if (node.type !== "NarrationSource") return node;
    return { ...node, config: { ...node.config, mode: "precomputed" as const, provider: "precomputed" as const, audioKey } };
  });
  return { ...graph, nodes };
}

/** Cria um job em draft a partir de um template já carregado (e já autorizado para o userId). */
export async function createDraftJob(
  userId: string,
  template: { id: string; graph: unknown },
  graphOverride?: GraphInput,
  meta?: { runId?: string; partIndex?: number },
): Promise<JobRow> {
  const graph = graphOverride ?? (() => {
    const parsed = graphSchema.safeParse(template.graph);
    if (!parsed.success) {
      throw new HttpError(400, { error: "invalid graph in template", details: parsed.error.flatten() });
    }
    return parsed.data;
  })();

  const [job] = await database
    .insert(jobs)
    .values({
      userId,
      templateId: template.id,
      status: "draft",
      graph,
      runId: meta?.runId,
      partIndex: meta?.partIndex,
    })
    .returning();

  return job!;
}

/** Carrega o template (já validando que pertence ao usuário). Usado por createDraftJob via a rota. */
export async function loadOwnedTemplate(userId: string, templateId: string) {
  const [template] = await database
    .select()
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.userId, userId)))
    .limit(1);

  if (!template) throw new HttpError(404, { error: "template not found" });
  return template;
}

/** Debita créditos de TTS (se aplicável), enfileira a geração de áudio. */
export async function startAudio(
  userId: string,
  job: JobRow,
  narration: StartAudioNarration,
): Promise<{ bullJobId: string }> {
  if (job.status !== "draft") {
    throw new HttpError(409, { error: "job must be in draft status", current: job.status });
  }

  const ttsCredits = narration.type === "tts" ? TTS_CREDITS_PER_MIN : 0;

  if (ttsCredits > 0) {
    const [balanceResult] = await database
      .select({ total: sum(creditTransactions.amount) })
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId));

    const balance = Number(balanceResult?.total ?? 0);
    if (balance < ttsCredits) {
      throw new HttpError(402, { error: "insufficient credits", required: ttsCredits, balance });
    }

    await database.insert(creditTransactions).values({
      userId,
      amount: -ttsCredits,
      reason: "tts",
      jobId: job.id,
    });
  }

  await database.update(jobs).set({ status: "audio_processing" }).where(eq(jobs.id, job.id));

  let audioJobNarration: AudioJobData["narration"];
  if (narration.type === "audio") {
    const [asset] = await database
      .select({ storageKey: assets.storageKey })
      .from(assets)
      .where(and(eq(assets.id, narration.assetId), eq(assets.userId, userId)))
      .limit(1);

    if (!asset) throw new HttpError(404, { error: "audio asset not found" });
    audioJobNarration = { type: "audio", assetStorageKey: asset.storageKey };
  } else {
    audioJobNarration = narration; // tts vai inteiro (provider, voz, modelo/estilo do gemini...)
  }

  const bullJob = await audioQueue.add("audio", { jobId: job.id, narration: audioJobNarration });
  return { bullJobId: bullJob.id! };
}

/** Valida o grafo, debita créditos de render e enfileira — atomicamente. */
export async function startRender(
  userId: string,
  job: JobRow,
): Promise<{ bullJobId: string; creditsCharged: number }> {
  const jobGraph = job.graph as GraphInput | null;
  const hasSceneSource = jobGraph?.nodes?.some((n) => n.type === "SceneSource") ?? false;
  const renderableStatuses = hasSceneSource ? ["ready"] : ["ready", "audio_ready"];

  if (!renderableStatuses.includes(job.status)) {
    throw new HttpError(409, { error: "job must be in ready status", current: job.status });
  }

  const graph = job.graph as GraphInput;
  const resolvedGraph = job.audioKey ? injectPrecomputedAudio(graph, job.audioKey) : graph;

  const structErrors = validateGraphStructure(resolvedGraph);
  if (structErrors.length > 0) {
    throw new HttpError(400, { error: "invalid graph structure", details: structErrors });
  }

  const renderCredits = RENDER_CREDITS_PER_MIN;

  let creditsCharged: number;
  try {
    creditsCharged = await database.transaction(async (tx) => {
      const [balanceResult] = await tx
        .select({ total: sum(creditTransactions.amount) })
        .from(creditTransactions)
        .where(eq(creditTransactions.userId, userId));

      const balance = Number(balanceResult?.total ?? 0);
      if (balance < renderCredits) throw { status: 402, balance };

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
      throw new HttpError(402, { error: "insufficient credits", required: renderCredits, balance: (err as Record<string, unknown>).balance });
    }
    throw err;
  }

  const bullJob = await renderQueue.add("render", { jobId: job.id });
  return { bullJobId: bullJob.id!, creditsCharged };
}
