ALTER TABLE "profiles" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE INDEX "profiles_external_id_idx" ON "profiles" USING btree ("platform","external_id");