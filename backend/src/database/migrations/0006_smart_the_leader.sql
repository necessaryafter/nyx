CREATE TYPE "public"."scheduler_mode" AS ENUM('single', 'parts');--> statement-breakpoint
CREATE TYPE "public"."scheduler_run_status" AS ENUM('pending', 'scripting', 'rendering', 'done', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."scheduler_run_trigger" AS ENUM('manual', 'schedule');--> statement-breakpoint
CREATE TABLE "scheduler_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduler_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" "scheduler_run_status" DEFAULT 'pending' NOT NULL,
	"triggered_by" "scheduler_run_trigger" NOT NULL,
	"title" text,
	"script" jsonb,
	"parts_total" integer NOT NULL,
	"parts_done" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "schedulers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"template_id" uuid NOT NULL,
	"theme" text NOT NULL,
	"asset_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"music_asset_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mode" "scheduler_mode" NOT NULL,
	"total_minutes" numeric,
	"parts_count" integer,
	"minutes_per_part" numeric,
	"cta_template" text DEFAULT 'Curta e comente para a parte {next}.' NOT NULL,
	"final_cta_template" text,
	"ai_provider" text DEFAULT 'gemini' NOT NULL,
	"ai_model" text NOT NULL,
	"cron_pattern" text,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "run_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "part_index" integer;--> statement-breakpoint
ALTER TABLE "scheduler_runs" ADD CONSTRAINT "scheduler_runs_scheduler_id_schedulers_id_fk" FOREIGN KEY ("scheduler_id") REFERENCES "public"."schedulers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedulers" ADD CONSTRAINT "schedulers_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scheduler_runs_scheduler_id_idx" ON "scheduler_runs" USING btree ("scheduler_id");--> statement-breakpoint
CREATE INDEX "schedulers_user_id_idx" ON "schedulers" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_run_id_scheduler_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."scheduler_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_run_id_idx" ON "jobs" USING btree ("run_id");