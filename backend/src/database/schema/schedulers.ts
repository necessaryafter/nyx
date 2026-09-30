import { pgTable, pgEnum, uuid, text, integer, numeric, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { templates } from "./templates";

export const schedulerModeEnum = pgEnum("scheduler_mode", ["single", "parts"]);

export const schedulerRunStatusEnum = pgEnum("scheduler_run_status", [
  "pending",    // criado, ainda não começou
  "scripting",  // gerando o roteiro com a IA
  "rendering",  // partes sendo geradas
  "done",       // todas as partes concluídas
  "partial",    // pelo menos uma parte concluída e pelo menos uma falhou
  "failed",     // nenhuma parte concluída
]);

export const schedulerRunTriggerEnum = pgEnum("scheduler_run_trigger", ["manual", "schedule"]);

export const schedulers = pgTable("schedulers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  templateId: uuid("template_id").notNull().references(() => templates.id, { onDelete: "restrict" }),
  theme: text("theme").notNull(),
  assetIds: jsonb("asset_ids").$type<string[]>().notNull().default([]),
  musicAssetIds: jsonb("music_asset_ids").$type<string[]>().notNull().default([]),
  mode: schedulerModeEnum("mode").notNull(),
  // false = mesma lista de vídeos em todas as partes (comportamento de sempre);
  // true = divide o pool entre as partes (round-robin) pra não repetir o mesmo vídeo.
  noRepeatAssetsAcrossParts: boolean("no_repeat_assets_across_parts").notNull().default(false),
  // true (default) = mantém o sorteio de sempre; false = ordem alfabética pelo nome do asset.
  randomizeAssetOrder: boolean("randomize_asset_order").notNull().default(true),
  // 1 (default) = velocidade normal do vídeo de fundo; ex. 1.5 = 50% mais rápido.
  backgroundSpeed: numeric("background_speed", { mode: "number" }).notNull().default(1),
  totalMinutes: numeric("total_minutes", { mode: "number" }),
  partsCount: integer("parts_count"),
  minutesPerPart: numeric("minutes_per_part", { mode: "number" }),
  ctaTemplate: text("cta_template").notNull().default("Curta e comente para a parte {next}."),
  finalCtaTemplate: text("final_cta_template"),
  // false (default) = última parte fala "Parte N." igual as demais; true = fala "Parte final.".
  finalPartEnabled: boolean("final_part_enabled").notNull().default(false),
  aiProvider: text("ai_provider").notNull().default("gemini"),
  aiModel: text("ai_model").notNull(),
  cronPattern: text("cron_pattern"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("schedulers_user_id_idx").on(t.userId),
]);

export const schedulerRuns = pgTable("scheduler_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  schedulerId: uuid("scheduler_id").notNull().references(() => schedulers.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  status: schedulerRunStatusEnum("status").notNull().default("pending"),
  triggeredBy: schedulerRunTriggerEnum("triggered_by").notNull(),
  title: text("title"),
  script: jsonb("script"),
  partsTotal: integer("parts_total").notNull(),
  partsDone: integer("parts_done").notNull().default(0),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("scheduler_runs_scheduler_id_idx").on(t.schedulerId),
]);

export const schedulersRelations = relations(schedulers, ({ many }) => ({
  runs: many(schedulerRuns),
}));

export const schedulerRunsRelations = relations(schedulerRuns, ({ one }) => ({
  scheduler: one(schedulers, {
    fields: [schedulerRuns.schedulerId],
    references: [schedulers.id],
  }),
  // As partes (jobs.runId -> scheduler_runs.id) são buscadas por query direta,
  // não pela API relacional do Drizzle — evita import circular com jobs.ts.
}));
