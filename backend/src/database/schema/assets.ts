import { pgTable, pgEnum, uuid, text, bigint, timestamp, index } from "drizzle-orm/pg-core";
import { assetImportBatches } from "./assetImports";

export const assetTypeEnum = pgEnum("asset_type", ["video", "audio", "text", "image"]);

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  type: assetTypeEnum("type").notNull(),
  storageKey: text("storage_key").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  importBatchId: uuid("import_batch_id").references(() => assetImportBatches.id, { onDelete: "set null" }), // asset-import: nulo = asset normal
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("assets_user_id_idx").on(t.userId),
  index("assets_import_batch_id_idx").on(t.importBatchId),
]);
