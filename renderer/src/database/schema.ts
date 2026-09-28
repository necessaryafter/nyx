import { pgTable, pgEnum, uuid, text, integer, bigint, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import type { Graph } from "../graph";

export const assetTypeEnum = pgEnum("asset_type", ["video", "audio", "text"]);

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey(),
  storageKey: text("storage_key").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
}, () => []);

export const jobStatusEnum = pgEnum("job_status", [
  "draft", "audio_processing", "audio_ready", "ready", "rendering",
  "pending", "processing", "done", "failed",
]);

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  templateId: uuid("template_id").notNull(),
  status: jobStatusEnum("status").notNull().default("pending"),
  graph: jsonb("graph").$type<Graph>().notNull(),
  audioKey: text("audio_key"),
  sceneSlots: jsonb("scene_slots"),
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

export const assetImportStatusEnum = pgEnum("asset_import_status", [
  "detecting", "awaiting_fallback_choice", "awaiting_review", "done", "discarded", "failed",
]);

export interface ImportSegment {
  index: number;
  startMs: number;
  endMs: number;
  clipStorageKey: string;
  thumbnailKey: string;
  selected: boolean;
  name?: string;
}

// Mirror de asset_import_batches (só as colunas que o worker lê/escreve).
export const assetImportBatches = pgTable("asset_import_batches", {
  id: uuid("id").primaryKey(),
  userId: text("user_id").notNull(),
  sourceStorageKey: text("source_storage_key").notNull(),
  sourceDurationMs: integer("source_duration_ms"),
  status: assetImportStatusEnum("status").notNull().default("detecting"),
  segments: jsonb("segments").$type<ImportSegment[]>().notNull().default([]),
  error: text("error"),
}, () => []);

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey(),
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(),
  encryptedApiKey: text("encrypted_api_key").notNull(),
}, (t) => [
  uniqueIndex("integrations_user_provider_idx").on(t.userId, t.provider),
]);
