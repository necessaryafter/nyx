ALTER TABLE "assets" ADD COLUMN "category" text;--> statement-breakpoint
CREATE INDEX "assets_user_category_idx" ON "assets" USING btree ("user_id","category");