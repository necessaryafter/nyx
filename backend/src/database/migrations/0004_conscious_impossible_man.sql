ALTER TYPE "public"."credit_reason" ADD VALUE 'refund';--> statement-breakpoint
ALTER TYPE "public"."job_status" ADD VALUE 'draft' BEFORE 'pending';--> statement-breakpoint
ALTER TYPE "public"."job_status" ADD VALUE 'audio_processing' BEFORE 'pending';--> statement-breakpoint
ALTER TYPE "public"."job_status" ADD VALUE 'audio_ready' BEFORE 'pending';--> statement-breakpoint
ALTER TYPE "public"."job_status" ADD VALUE 'ready' BEFORE 'pending';--> statement-breakpoint
ALTER TYPE "public"."job_status" ADD VALUE 'rendering' BEFORE 'pending';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "audio_key" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "scene_slots" jsonb;