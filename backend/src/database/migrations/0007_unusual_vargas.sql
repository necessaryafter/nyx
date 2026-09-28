CREATE TYPE "public"."asset_import_status" AS ENUM('detecting', 'awaiting_fallback_choice', 'awaiting_review', 'done', 'discarded', 'failed');--> statement-breakpoint
CREATE TABLE "asset_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"source_name" text NOT NULL,
	"source_storage_key" text NOT NULL,
	"source_duration_ms" integer,
	"status" "asset_import_status" DEFAULT 'detecting' NOT NULL,
	"segments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "import_batch_id" uuid;--> statement-breakpoint
CREATE INDEX "asset_import_batches_user_id_idx" ON "asset_import_batches" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_import_batch_id_asset_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."asset_import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_import_batch_id_idx" ON "assets" USING btree ("import_batch_id");