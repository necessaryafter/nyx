import { Worker, type Job as BullJob } from "bullmq";
import { eq, and, inArray, desc } from "drizzle-orm";
import { database } from "../database";
import { schedulers, schedulerRuns, schedulerStoryHistory } from "../database/schema/schedulers";
import { jobs } from "../database/schema/jobs";
import { templates } from "../database/schema/templates";
import { assets } from "../database/schema/assets";
import { audioQueue, renderQueue, audioQueueEvents, renderQueueEvents } from "../lib/queue";
import { createDraftJob, startAudio, startRender } from "../lib/jobs.service";
import { applySchedulerOverrides, planPartAssetIds, randomEngagement, resolveSchedulerVoice, type SchedulerCardContext } from "../lib/scheduler/overrides";
import { estimateRun } from "../lib/scheduler/estimate";
import { generateSeriesScript, type SeriesScript } from "../lib/ai/seriesScript";
import { resolveGeminiKey } from "../lib/ai/gemini";
import { getBalance } from "../lib/credits";
import { graphSchema } from "../lib/schemas";
import { broadcast } from "../routes/ws";
import { logger } from "@nyx/shared";

export interface SchedulerRunJobData {
  schedulerId: string;
  triggeredBy: "manual" | "schedule";
}

const AUDIO_TIMEOUT_MS = 10 * 60_000;
const RENDER_TIMEOUT_MS = 30 * 60_000;
const IN_FLIGHT_STATUSES = ["pending", "scripting", "rendering"] as const;

type SchedulerRunUpdate = Partial<typeof schedulerRuns.$inferInsert>;

async function updateRun(runId: string, patch: SchedulerRunUpdate) {
  await database.update(schedulerRuns).set(patch).where(eq(schedulerRuns.id, runId));
}

function broadcastRun(
  userId: string,
  run: { id: string; schedulerId: string; status: string; partsDone: number; partsTotal: number; title?: string | null },
) {
  broadcast(userId, {
    type: "run:status",
    runId: run.id,
    schedulerId: run.schedulerId,
    status: run.status,
    partsDone: run.partsDone,
    partsTotal: run.partsTotal,
    ...(run.title ? { title: run.title } : {}),
  });
}

async function runOnePart(
  part: SeriesScript["parts"][number],
  ctx: {
    userId: string;
    runId: string;
    template: { id: string; graph: unknown };
    graph: ReturnType<typeof graphSchema.parse>;
    scheduler: typeof schedulers.$inferSelect;
    partAssetIds: string[];
    title: string;
    partsTotal: number;
    voice: ReturnType<typeof resolveSchedulerVoice>;
    card: SchedulerCardContext;
  },
): Promise<void> {
  const overriddenGraph = applySchedulerOverrides(ctx.graph, {
    assetIds: ctx.partAssetIds,
    // noRepeat: a ordem já vem planejada por parte (planPartAssetIds) — o renderer não pode reembaralhar.
    assetMode: ctx.scheduler.randomizeAssetOrder && !ctx.scheduler.noRepeatAssetsAcrossParts ? "random-loop" : "sequential",
    musicAssetIds: ctx.scheduler.musicAssetIds,
    backgroundSpeed: ctx.scheduler.backgroundSpeed,
    title: ctx.title,
    partIndex: part.index,
    partsTotal: ctx.partsTotal,
    card: ctx.card,
  });

  const job = await createDraftJob(ctx.userId, ctx.template, overriddenGraph, {
    runId: ctx.runId,
    partIndex: part.index,
  });

  const { bullJobId: audioBullJobId } = await startAudio(ctx.userId, job, {
    ...ctx.voice,
    type: "tts",
    text: part.text,
  });

  const audioBullJob = await audioQueue.getJob(audioBullJobId);
  if (!audioBullJob) throw new Error("audio job desapareceu da fila");
  await audioBullJob.waitUntilFinished(audioQueueEvents, AUDIO_TIMEOUT_MS);

  const [afterAudio] = await database.select().from(jobs).where(eq(jobs.id, job.id)).limit(1);
  if (!afterAudio || afterAudio.status === "failed") {
    throw new Error(afterAudio?.error ?? "geração de áudio falhou");
  }

  const { bullJobId: renderBullJobId } = await startRender(ctx.userId, afterAudio);
  const renderBullJob = await renderQueue.getJob(renderBullJobId);
  if (!renderBullJob) throw new Error("render job desapareceu da fila");
  await renderBullJob.waitUntilFinished(renderQueueEvents, RENDER_TIMEOUT_MS);

  const [afterRender] = await database.select().from(jobs).where(eq(jobs.id, job.id)).limit(1);
  if (!afterRender || afterRender.status !== "done") {
    throw new Error(afterRender?.error ?? "render falhou");
  }
}

async function handleRun(bullJob: BullJob<SchedulerRunJobData>): Promise<void> {
  const { schedulerId, triggeredBy } = bullJob.data;

  const [scheduler] = await database.select().from(schedulers).where(eq(schedulers.id, schedulerId)).limit(1);
  if (!scheduler) {
    logger.warn({ schedulerId }, "scheduler not found, skipping run");
    return;
  }
  if (!scheduler.enabled && triggeredBy === "schedule") return;

  const userId = scheduler.userId;
  const partsTotal = scheduler.mode === "single" ? 1 : (scheduler.partsCount ?? 1);

  const [inFlight] = await database
    .select({ id: schedulerRuns.id })
    .from(schedulerRuns)
    .where(and(eq(schedulerRuns.schedulerId, schedulerId), inArray(schedulerRuns.status, IN_FLIGHT_STATUSES)))
    .limit(1);

  if (inFlight) {
    const [run] = await database
      .insert(schedulerRuns)
      .values({
        schedulerId,
        userId,
        status: "failed",
        triggeredBy,
        partsTotal,
        error: "execução anterior deste scheduler ainda em andamento",
        completedAt: new Date(),
      })
      .returning();
    broadcastRun(userId, { id: run!.id, schedulerId, status: "failed", partsDone: 0, partsTotal });
    return;
  }

  const [run] = await database
    .insert(schedulerRuns)
    .values({ schedulerId, userId, status: "pending", triggeredBy, partsTotal })
    .returning();
  const runId = run!.id;

  async function fail(error: string) {
    await updateRun(runId, { status: "failed", error, completedAt: new Date() });
    broadcastRun(userId, { id: runId, schedulerId, status: "failed", partsDone: 0, partsTotal });
  }

  // Checagem prévia de créditos — não cobra nada aqui, a cobrança real é por
  // parte, nos mesmos services que o fluxo manual de job usa.
  const estimate = estimateRun({
    mode: scheduler.mode,
    totalMinutes: scheduler.totalMinutes ?? undefined,
    partsCount: scheduler.partsCount ?? undefined,
    minutesPerPart: scheduler.minutesPerPart ?? undefined,
  });
  const balance = await getBalance(userId);
  if (balance < estimate.creditsTotal) {
    await fail(`créditos insuficientes (precisa ${estimate.creditsTotal}, tem ${balance})`);
    return;
  }

  const apiKey = await resolveGeminiKey(userId);
  if (!apiKey) {
    await fail("Configure sua chave do Gemini em Configurações → Integrações");
    return;
  }

  await updateRun(runId, { status: "scripting", startedAt: new Date() });
  broadcastRun(userId, { id: runId, schedulerId, status: "scripting", partsDone: 0, partsTotal });

  // Histórico próprio do scheduler (não some quando as execuções são apagadas).
  const history = await database
    .select({ title: schedulerStoryHistory.title, premise: schedulerStoryHistory.premise })
    .from(schedulerStoryHistory)
    .where(eq(schedulerStoryHistory.schedulerId, schedulerId))
    .orderBy(desc(schedulerStoryHistory.createdAt))
    .limit(50);
  const avoidTitles = history.map((h) => h.title);
  const avoidPremises = history.map((h) => h.premise ?? "");

  let script: SeriesScript;
  try {
    script = await generateSeriesScript({
      apiKey,
      model: scheduler.aiModel,
      theme: scheduler.theme,
      parts: partsTotal,
      minutesPerPart: scheduler.mode === "single" ? (scheduler.totalMinutes ?? 0) : (scheduler.minutesPerPart ?? 0),
      ctaTemplate: scheduler.ctaTemplate,
      finalCtaTemplate: scheduler.finalCtaTemplate ?? undefined,
      finalPartEnabled: scheduler.finalPartEnabled,
      finalPartLabel: scheduler.finalPartLabel,
      avoidTitles,
      avoidPremises,
    });
  } catch (err) {
    await fail(err instanceof Error ? err.message : "falha ao gerar roteiro da série");
    return;
  }

  // Grava já na geração: mesmo que a renderização falhe depois, essa história não volta.
  await database.insert(schedulerStoryHistory).values({
    schedulerId,
    title: script.title,
    premise: script.parts[0]?.body.slice(0, 400) ?? null,
  });

  await updateRun(runId, { status: "rendering", title: script.title, script });
  broadcastRun(userId, { id: runId, schedulerId, status: "rendering", partsDone: 0, partsTotal, title: script.title });

  const [template] = await database.select().from(templates).where(eq(templates.id, scheduler.templateId)).limit(1);
  if (!template) {
    await fail("template não encontrado (pode ter sido apagado)");
    return;
  }

  const graphParsed = graphSchema.safeParse(template.graph);
  if (!graphParsed.success) {
    await fail("grafo do template inválido");
    return;
  }

  const narrationNode = graphParsed.data.nodes.find((n) => n.type === "NarrationSource");
  const narrationCfg = narrationNode?.type === "NarrationSource" ? narrationNode.config : undefined;
  const voice = resolveSchedulerVoice(narrationCfg, scheduler.narration);

  // Identidade do post: subreddit/usuário/tag vêm da IA (junto do roteiro),
  // votos/comentários/tempo são só cosméticos — gerados uma vez aqui e
  // reaproveitados em todas as partes desta execução (mas mudam a cada
  // execução nova, em vez de ficar congelado no template).
  const card: SchedulerCardContext = { ...script.card, ...randomEngagement() };

  // Ordem sequencial precisa do nome de cada asset — só busca quando faz diferença.
  let nameById: Map<string, string> | undefined;
  if (!scheduler.randomizeAssetOrder && scheduler.assetIds.length > 0) {
    const rows = await database.select({ id: assets.id, name: assets.name }).from(assets).where(inArray(assets.id, scheduler.assetIds));
    nameById = new Map(rows.map((r) => [r.id, r.name]));
  }
  const assetPlan = planPartAssetIds(scheduler.assetIds, partsTotal, {
    randomize: scheduler.randomizeAssetOrder,
    noRepeatAcrossParts: scheduler.noRepeatAssetsAcrossParts,
    nameById,
  });

  let partsDone = 0;
  const partErrors: string[] = []; // vão pro run.error — é o que aparece pro usuário na execução

  for (const part of script.parts) {
    try {
      await runOnePart(part, {
        userId,
        runId,
        template,
        graph: graphParsed.data,
        scheduler,
        partAssetIds: assetPlan[part.index - 1] ?? [],
        title: script.title,
        partsTotal,
        voice,
        card,
      });
      partsDone++;
    } catch (err) {
      logger.error({ err, runId, part: part.index }, "scheduler part failed");
      const message = err instanceof Error ? err.message : String(err);
      partErrors.push(`Parte ${part.index}: ${message}`);
      // Cota esgotada (mensagem do renderer) vale pras partes seguintes também — não adianta tentar.
      if (/cota .*esgotada/i.test(message) && part.index < partsTotal) {
        partErrors.push(`Partes ${part.index + 1} a ${partsTotal} não foram geradas (mesma cota).`);
        await updateRun(runId, { partsDone, error: partErrors.join("\n") });
        break;
      }
    }

    await updateRun(runId, { partsDone, ...(partErrors.length && { error: partErrors.join("\n") }) });
    broadcastRun(userId, { id: runId, schedulerId, status: "rendering", partsDone, partsTotal });
  }

  const finalStatus = partsDone === partsTotal ? "done" : partsDone > 0 ? "partial" : "failed";
  await updateRun(runId, { status: finalStatus, partsDone, completedAt: new Date() });
  await database.update(schedulers).set({ lastRunAt: new Date() }).where(eq(schedulers.id, schedulerId));
  broadcastRun(userId, { id: runId, schedulerId, status: finalStatus, partsDone, partsTotal, title: script.title });
}

export function startSchedulerWorker() {
  const worker = new Worker<SchedulerRunJobData>("scheduler", handleRun, {
    connection: { url: process.env.REDIS_URL! },
    concurrency: 1, // uma execução por vez — partes já rodam em sequência dentro dela
  });

  worker.on("failed", (bullJob, err) => {
    logger.error({ schedulerId: bullJob?.data.schedulerId, err: err.message }, "scheduler run failed in BullMQ");
  });

  return worker;
}
