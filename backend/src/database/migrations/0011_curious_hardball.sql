CREATE TABLE "scheduler_story_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduler_id" uuid NOT NULL,
	"title" text NOT NULL,
	"premise" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "scheduler_story_history" ADD CONSTRAINT "scheduler_story_history_scheduler_id_schedulers_id_fk" FOREIGN KEY ("scheduler_id") REFERENCES "public"."schedulers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scheduler_story_history_scheduler_id_idx" ON "scheduler_story_history" USING btree ("scheduler_id");--> statement-breakpoint
-- Aproveita os títulos que já estão nas execuções existentes.
INSERT INTO "scheduler_story_history" ("scheduler_id", "title", "premise", "created_at")
SELECT DISTINCT ON ("scheduler_id", "title") "scheduler_id", "title", left("script"->'parts'->0->>'body', 400), "created_at"
FROM "scheduler_runs"
WHERE "title" IS NOT NULL
ORDER BY "scheduler_id", "title", "created_at";
