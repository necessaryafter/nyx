import { Elysia } from "elysia";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { ZipArchive } from "archiver";
import { eq, and, desc, count, inArray } from "drizzle-orm";
import { requireAuth } from "../auth/session";
import { database } from "../database";
import { schedulers, schedulerRuns } from "../database/schema/schedulers";
import { templates } from "../database/schema/templates";
import { jobs } from "../database/schema/jobs";
import { storageClient as minio, BUCKET_VIDEOS, logger } from "@nyx/shared";
import {
  createSchedulerSchema,
  updateSchedulerSchema,
  schedulerEstimateQuerySchema,
  graphSchema,
  paginationSchema,
} from "../lib/schemas";
import { estimateRun } from "../lib/scheduler/estimate";
import { syncBullScheduler, removeBullScheduler, getNextRunAt } from "../lib/scheduler/sync";
import { schedulerQueue } from "../lib/queue";

const MAX_ENABLED_SCHEDULERS = 10;

type SchedulerRow = typeof schedulers.$inferSelect;

function toSchedulerDTO(row: SchedulerRow, templateName: string | null) {
  const { userId: _userId, ...rest } = row;
  return { ...rest, templateName };
}

/** "Eu descobri que..." -> "eu_descobri_que" — nome de arquivo seguro pro .zip do lote. */
function slugifyFilename(text: string, maxLength = 60): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug.slice(0, maxLength) || "lote";
}

async function assertNoSceneSource(templateId: string, userId: string) {
  const [template] = await database
    .select({ id: templates.id, name: templates.name, graph: templates.graph })
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.userId, userId)))
    .limit(1);

  if (!template) return { error: { status: 404 as const, body: { error: "template not found" } } };

  const graphParsed = graphSchema.safeParse(template.graph);
  if (!graphParsed.success) {
    return { error: { status: 400 as const, body: { error: "invalid graph in template" } } };
  }
  if (graphParsed.data.nodes.some((n) => n.type === "SceneSource")) {
    return {
      error: {
        status: 400 as const,
        body: { error: "este template usa slots de cena; o scheduler só funciona com templates de fundo fixo" },
      },
    };
  }

  return { template };
}

export const schedulerRoutes = new Elysia({ prefix: "/api/schedulers" })
  .use(requireAuth)

  // ── Cria scheduler ──
  .post("/", async ({ body, session, set }) => {
    const parsed = createSchedulerSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "invalid fields", details: parsed.error.flatten() };
    }

    const userId = session.user.id;
    const check = await assertNoSceneSource(parsed.data.templateId, userId);
    if (check.error) {
      set.status = check.error.status;
      return check.error.body;
    }

    const [{ value: enabledCount }] = await database
      .select({ value: count() })
      .from(schedulers)
      .where(and(eq(schedulers.userId, userId), eq(schedulers.enabled, true)));

    if (Number(enabledCount) >= MAX_ENABLED_SCHEDULERS) {
      set.status = 409;
      return { error: `limite de ${MAX_ENABLED_SCHEDULERS} schedulers habilitados por conta` };
    }

    const { runOnCreate, ...data } = parsed.data;
    const id = randomUUID();
    const draft: SchedulerRow = {
      id,
      userId,
      name: data.name,
      templateId: data.templateId,
      theme: data.theme,
      assetIds: data.assetIds,
      musicAssetIds: data.musicAssetIds,
      mode: data.mode,
      totalMinutes: data.totalMinutes ?? null,
      partsCount: data.partsCount ?? null,
      minutesPerPart: data.minutesPerPart ?? null,
      noRepeatAssetsAcrossParts: data.noRepeatAssetsAcrossParts,
      randomizeAssetOrder: data.randomizeAssetOrder,
      backgroundSpeed: data.backgroundSpeed,
      ctaTemplate: data.ctaTemplate,
      finalCtaTemplate: data.finalCtaTemplate ?? null,
      finalPartEnabled: data.finalPartEnabled,
      aiProvider: "gemini",
      aiModel: data.aiModel,
      cronPattern: data.cronPattern ?? null,
      timezone: data.timezone,
      enabled: true,
      lastRunAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Sincroniza o BullMQ ANTES de gravar — assim uma expressão cron inválida
    // vira 400 sem deixar linha nenhuma pra trás (nada pra "desfazer" depois).
    try {
      await syncBullScheduler(draft);
    } catch {
      set.status = 400;
      return { error: "expressão cron inválida" };
    }

    const [scheduler] = await database.insert(schedulers).values(draft).returning();

    if (runOnCreate) {
      await schedulerQueue.add("run", { schedulerId: id, triggeredBy: "manual" as const });
    }

    set.status = 201;
    return toSchedulerDTO(scheduler!, check.template!.name);
  })

  // ── Lista schedulers do usuário ──
  .get("/", async ({ session, query, set }) => {
    const pagination = paginationSchema.pick({ limit: true, offset: true }).safeParse(query);
    if (!pagination.success) {
      set.status = 400;
      return { error: "invalid pagination", details: pagination.error.flatten() };
    }
    const { limit, offset } = pagination.data;
    const userId = session.user.id;

    const [rows, [total]] = await Promise.all([
      database
        .select({ scheduler: schedulers, templateName: templates.name })
        .from(schedulers)
        .leftJoin(templates, eq(schedulers.templateId, templates.id))
        .where(eq(schedulers.userId, userId))
        .orderBy(desc(schedulers.createdAt))
        .limit(limit)
        .offset(offset),
      database.select({ count: count() }).from(schedulers).where(eq(schedulers.userId, userId)),
    ]);

    const data = await Promise.all(
      rows.map(async ({ scheduler, templateName }) => {
        const [lastRun] = await database
          .select({
            id: schedulerRuns.id,
            status: schedulerRuns.status,
            partsDone: schedulerRuns.partsDone,
            partsTotal: schedulerRuns.partsTotal,
            createdAt: schedulerRuns.createdAt,
          })
          .from(schedulerRuns)
          .where(eq(schedulerRuns.schedulerId, scheduler.id))
          .orderBy(desc(schedulerRuns.createdAt))
          .limit(1);

        const nextRunAt = scheduler.enabled && scheduler.cronPattern ? await getNextRunAt(scheduler.id) : null;

        return { ...toSchedulerDTO(scheduler, templateName), lastRun: lastRun ?? null, nextRunAt };
      }),
    );

    return { data, total: total!.count, limit, offset };
  })

  // ── Detalhe: scheduler + últimas execuções com suas partes ──
  .get("/:id", async ({ params, session, set }) => {
    const userId = session.user.id;

    const [row] = await database
      .select({ scheduler: schedulers, templateName: templates.name })
      .from(schedulers)
      .leftJoin(templates, eq(schedulers.templateId, templates.id))
      .where(and(eq(schedulers.id, params.id), eq(schedulers.userId, userId)))
      .limit(1);

    if (!row) {
      set.status = 404;
      return { error: "scheduler not found" };
    }

    const runs = await database
      .select()
      .from(schedulerRuns)
      .where(eq(schedulerRuns.schedulerId, params.id))
      .orderBy(desc(schedulerRuns.createdAt))
      .limit(20);

    const runIds = runs.map((r) => r.id);
    const parts = runIds.length
      ? await database
          .select({
            runId: jobs.runId,
            jobId: jobs.id,
            partIndex: jobs.partIndex,
            status: jobs.status,
            durationSeconds: jobs.durationSeconds,
            videoKey: jobs.videoKey,
          })
          .from(jobs)
          .where(inArray(jobs.runId, runIds))
      : [];

    const partsByRun = new Map<string, typeof parts>();
    for (const part of parts) {
      const list = partsByRun.get(part.runId!) ?? [];
      list.push(part);
      partsByRun.set(part.runId!, list);
    }

    const nextRunAt = row.scheduler.enabled && row.scheduler.cronPattern ? await getNextRunAt(params.id) : null;

    return {
      ...toSchedulerDTO(row.scheduler, row.templateName),
      nextRunAt,
      runs: runs.map((run) => ({
        ...run,
        parts: (partsByRun.get(run.id) ?? [])
          .sort((a, b) => (a.partIndex ?? 0) - (b.partIndex ?? 0))
          .map((p) => ({
            jobId: p.jobId,
            partIndex: p.partIndex,
            status: p.status,
            durationSeconds: p.durationSeconds,
            hasVideo: !!p.videoKey,
          })),
      })),
    };
  })

  // ── Uma execução específica, com o roteiro completo ──
  .get("/:id/runs/:runId", async ({ params, session, set }) => {
    const userId = session.user.id;

    const [run] = await database
      .select()
      .from(schedulerRuns)
      .where(and(eq(schedulerRuns.id, params.runId), eq(schedulerRuns.schedulerId, params.id), eq(schedulerRuns.userId, userId)))
      .limit(1);

    if (!run) {
      set.status = 404;
      return { error: "run not found" };
    }

    const parts = await database
      .select({
        jobId: jobs.id,
        partIndex: jobs.partIndex,
        status: jobs.status,
        durationSeconds: jobs.durationSeconds,
        videoKey: jobs.videoKey,
      })
      .from(jobs)
      .where(eq(jobs.runId, run.id));

    return {
      ...run,
      parts: parts
        .sort((a, b) => (a.partIndex ?? 0) - (b.partIndex ?? 0))
        .map((p) => ({ jobId: p.jobId, partIndex: p.partIndex, status: p.status, durationSeconds: p.durationSeconds, hasVideo: !!p.videoKey })),
    };
  })

  // ── Baixa todas as partes prontas de uma execução como .zip (parte_1.mp4, parte_2.mp4, ...) ──
  .get("/:id/runs/:runId/download", async ({ params, session, set }) => {
    const userId = session.user.id;

    const [run] = await database
      .select({ id: schedulerRuns.id, title: schedulerRuns.title })
      .from(schedulerRuns)
      .where(and(eq(schedulerRuns.id, params.runId), eq(schedulerRuns.schedulerId, params.id), eq(schedulerRuns.userId, userId)))
      .limit(1);

    if (!run) {
      set.status = 404;
      return { error: "run not found" };
    }

    const parts = await database
      .select({ partIndex: jobs.partIndex, status: jobs.status, videoKey: jobs.videoKey })
      .from(jobs)
      .where(eq(jobs.runId, run.id));

    const ready = parts
      .filter((p) => p.status === "done" && !!p.videoKey)
      .sort((a, b) => (a.partIndex ?? 0) - (b.partIndex ?? 0));

    if (ready.length === 0) {
      set.status = 400;
      return { error: "nenhuma parte pronta pra download" };
    }

    // zlib level 0 = sem compressão extra — o mp4 já vem comprimido, o zip só embrulha.
    const archive = new ZipArchive({ zlib: { level: 0 } });
    archive.on("error", (err: Error) => logger.error({ runId: run.id, err: err.message }, "batch download: erro montando zip"));
    for (const p of ready) {
      const stream = await minio.getObject(BUCKET_VIDEOS, p.videoKey!);
      archive.append(stream, { name: `parte_${p.partIndex}.mp4` });
    }
    archive.finalize();

    const filename = `${slugifyFilename(run.title ?? "lote")}.zip`;
    return new Response(Readable.toWeb(archive) as unknown as ReadableStream, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  })

  // ── Atualiza scheduler ──
  .put("/:id", async ({ params, body, session, set }) => {
    const parsed = updateSchedulerSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "invalid fields", details: parsed.error.flatten() };
    }

    const userId = session.user.id;
    const [existing] = await database
      .select()
      .from(schedulers)
      .where(and(eq(schedulers.id, params.id), eq(schedulers.userId, userId)))
      .limit(1);

    if (!existing) {
      set.status = 404;
      return { error: "scheduler not found" };
    }

    if (parsed.data.templateId && parsed.data.templateId !== existing.templateId) {
      const check = await assertNoSceneSource(parsed.data.templateId, userId);
      if (check.error) {
        set.status = check.error.status;
        return check.error.body;
      }
    }

    const { runOnCreate: _ignored, ...data } = parsed.data;
    const merged: SchedulerRow = {
      ...existing,
      ...data,
      totalMinutes: data.totalMinutes ?? existing.totalMinutes,
      partsCount: data.partsCount ?? existing.partsCount,
      minutesPerPart: data.minutesPerPart ?? existing.minutesPerPart,
      finalCtaTemplate: data.finalCtaTemplate ?? existing.finalCtaTemplate,
      cronPattern: data.cronPattern !== undefined ? data.cronPattern : existing.cronPattern,
      updatedAt: new Date(),
    };

    try {
      await syncBullScheduler(merged);
    } catch {
      set.status = 400;
      return { error: "expressão cron inválida" };
    }

    const [scheduler] = await database.update(schedulers).set(merged).where(eq(schedulers.id, params.id)).returning();

    const [{ name: templateName }] = await database
      .select({ name: templates.name })
      .from(templates)
      .where(eq(templates.id, scheduler!.templateId))
      .limit(1);

    return toSchedulerDTO(scheduler!, templateName ?? null);
  })

  // ── Roda agora ──
  .post("/:id/run", async ({ params, session, set }) => {
    const userId = session.user.id;
    const [scheduler] = await database
      .select({ id: schedulers.id })
      .from(schedulers)
      .where(and(eq(schedulers.id, params.id), eq(schedulers.userId, userId)))
      .limit(1);

    if (!scheduler) {
      set.status = 404;
      return { error: "scheduler not found" };
    }

    const [inFlight] = await database
      .select({ id: schedulerRuns.id })
      .from(schedulerRuns)
      .where(and(eq(schedulerRuns.schedulerId, params.id), inArray(schedulerRuns.status, ["pending", "scripting", "rendering"])))
      .limit(1);

    if (inFlight) {
      set.status = 409;
      return { error: "já existe uma execução em andamento para este scheduler" };
    }

    await schedulerQueue.add("run", { schedulerId: params.id, triggeredBy: "manual" as const });
    set.status = 202;
    return { runQueued: true };
  })

  // ── Pausa / retoma ──
  .post("/:id/pause", async (ctx) => setEnabled(ctx, false))
  .post("/:id/resume", async (ctx) => setEnabled(ctx, true))

  // ── Remove scheduler (mantém os jobs/vídeos já gerados) ──
  .delete("/:id", async ({ params, session, set }) => {
    const userId = session.user.id;
    const [existing] = await database
      .select({ id: schedulers.id })
      .from(schedulers)
      .where(and(eq(schedulers.id, params.id), eq(schedulers.userId, userId)))
      .limit(1);

    if (!existing) {
      set.status = 404;
      return { error: "scheduler not found" };
    }

    await removeBullScheduler(params.id);
    await database.delete(schedulers).where(eq(schedulers.id, params.id));

    set.status = 204;
    return;
  })

  // ── Estimativa de créditos/palavras antes de criar ──
  .get("/estimate", async ({ query, set }) => {
    const parsed = schedulerEstimateQuerySchema.safeParse(query);
    if (!parsed.success) {
      set.status = 400;
      return { error: "invalid fields", details: parsed.error.flatten() };
    }
    return estimateRun(parsed.data);
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- contexto do Elysia é um union complexo demais pra anotar aqui à mão
async function setEnabled({ params, session, set }: any, enabled: boolean) {
  const userId = session.user.id;
  const [existing] = await database
    .select()
    .from(schedulers)
    .where(and(eq(schedulers.id, params.id), eq(schedulers.userId, userId)))
    .limit(1);

  if (!existing) {
    set.status = 404;
    return { error: "scheduler not found" };
  }

  if (enabled) {
    const [{ value: enabledCount }] = await database
      .select({ value: count() })
      .from(schedulers)
      .where(and(eq(schedulers.userId, userId), eq(schedulers.enabled, true)));

    if (Number(enabledCount) >= MAX_ENABLED_SCHEDULERS) {
      set.status = 409;
      return { error: `limite de ${MAX_ENABLED_SCHEDULERS} schedulers habilitados por conta` };
    }
  }

  const updated = { ...existing, enabled, updatedAt: new Date() };
  await syncBullScheduler(updated);
  const [scheduler] = await database.update(schedulers).set(updated).where(eq(schedulers.id, params.id)).returning();

  const [{ name: templateName }] = await database
    .select({ name: templates.name })
    .from(templates)
    .where(eq(templates.id, scheduler!.templateId))
    .limit(1);

  return toSchedulerDTO(scheduler!, templateName ?? null);
}
