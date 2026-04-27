import { pgTable, pgEnum, uuid, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { templates } from "./templates";
import { creditTransactions } from "./credits";

export const jobStatusEnum = pgEnum("job_status", [
  // Staged flow
  "draft",            // template selecionado, aguardando narração
  "audio_processing", // TTS/WhisperX rodando
  "audio_ready",      // áudio pronto, aguardando mídias dos slots
  "ready",            // todos os slots preenchidos, pronto para renderizar
  "rendering",        // enfileirado e em execução
  // Legacy / render direto
  "pending",
  "processing",
  "done",
  "failed",
]);

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  templateId: uuid("template_id").notNull().references(() => templates.id, { onDelete: "restrict" }),
  status: jobStatusEnum("status").notNull().default("pending"),
  graph: jsonb("graph").notNull(),
  audioKey: text("audio_key"),        // MinIO storageKey do áudio gerado na etapa 2
  sceneSlots: jsonb("scene_slots"),   // SceneSlot[] — preenchido após áudio pronto
  videoKey: text("video_key"),
  durationSeconds: integer("duration_seconds"),
  creditsCharged: integer("credits_charged"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [
  index("jobs_user_id_idx").on(t.userId),
  index("jobs_status_idx").on(t.status),
]);

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  template: one(templates, {
    fields: [jobs.templateId],
    references: [templates.id],
  }),
  creditTransactions: many(creditTransactions),
}));
