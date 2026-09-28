import { pgTable, pgEnum, uuid, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const assetImportStatusEnum = pgEnum("asset_import_status", [
  "detecting",              // ffmpeg analisando o vídeo, ainda sem segmentos
  "awaiting_fallback_choice", // nenhum corte encontrado — esperando o usuário escolher o que fazer
  "awaiting_review",        // segmentos prontos (com miniatura), esperando confirmação
  "done",                   // confirmado, virou assets
  "discarded",              // usuário cancelou sem confirmar
  "failed",
]);

export interface ImportSegment {
  index: number;
  startMs: number;
  endMs: number;
  clipStorageKey: string; // MinIO — já cortado + convertido pra 1080x1920; temporário até confirmar
  thumbnailKey: string;   // MinIO — 1 frame do meio do trecho
  selected: boolean;      // default true; usuário desmarca na prévia
  name?: string;
}

export const assetImportBatches = pgTable("asset_import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  sourceName: text("source_name").notNull(),
  sourceStorageKey: text("source_storage_key").notNull(),
  sourceDurationMs: integer("source_duration_ms"),
  status: assetImportStatusEnum("status").notNull().default("detecting"),
  segments: jsonb("segments").$type<ImportSegment[]>().notNull().default([]),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [
  index("asset_import_batches_user_id_idx").on(t.userId),
]);
