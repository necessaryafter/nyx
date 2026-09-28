import { eq } from "drizzle-orm";
import { database } from "../../database";
import { schedulers } from "../../database/schema/schedulers";
import { schedulerQueue } from "../queue";
import { logger } from "@nyx/shared";

type SchedulerRow = typeof schedulers.$inferSelect;

/**
 * Fonte de verdade de "está agendado" é a linha no banco (enabled && cronPattern).
 * Chamado depois de qualquer create/update/pause/resume/delete pra manter o
 * BullMQ Job Scheduler sincronizado com o Postgres.
 */
export async function syncBullScheduler(scheduler: SchedulerRow): Promise<void> {
  if (scheduler.enabled && scheduler.cronPattern) {
    await schedulerQueue.upsertJobScheduler(
      scheduler.id,
      { pattern: scheduler.cronPattern, tz: scheduler.timezone },
      { name: "run", data: { schedulerId: scheduler.id, triggeredBy: "schedule" as const } },
    );
  } else {
    await schedulerQueue.removeJobScheduler(scheduler.id);
  }
}

export async function removeBullScheduler(schedulerId: string): Promise<void> {
  await schedulerQueue.removeJobScheduler(schedulerId);
}

export async function getNextRunAt(schedulerId: string): Promise<Date | null> {
  const job = await schedulerQueue.getJobScheduler(schedulerId);
  return job?.next ? new Date(job.next) : null;
}

/**
 * Re-registra todos os schedulers habilitados no BullMQ. Chamado na subida do
 * backend — cobre o caso de Redis limpo (dados persistidos só no Postgres).
 * Idempotente: upsertJobScheduler substitui o registro anterior, se houver.
 */
export async function reconcileAllSchedulers(): Promise<void> {
  const enabled = await database
    .select()
    .from(schedulers)
    .where(eq(schedulers.enabled, true));

  await Promise.all(
    enabled.map((s) =>
      syncBullScheduler(s).catch((err) => logger.error({ err, schedulerId: s.id }, "failed to reconcile scheduler")),
    ),
  );

  logger.info({ count: enabled.length }, "schedulers reconciled with BullMQ");
}
