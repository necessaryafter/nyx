ALTER TABLE "jobs" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "status" SET DEFAULT 'draft'::text;--> statement-breakpoint
DROP TYPE "public"."job_status";--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('draft', 'audio_processing', 'audio_ready', 'ready', 'rendering', 'done', 'failed');--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."job_status";--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "status" SET DATA TYPE "public"."job_status" USING "status"::"public"."job_status";