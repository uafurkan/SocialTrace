CREATE TYPE "public"."transcript_platform" AS ENUM('youtube', 'tiktok', 'instagram', 'facebook', 'upload');--> statement-breakpoint
CREATE TYPE "public"."transcript_status" AS ENUM('processing', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "transcript_cache" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"platform" "transcript_platform" NOT NULL,
	"source_url" text NOT NULL,
	"status" "transcript_status" DEFAULT 'processing' NOT NULL,
	"language" text,
	"duration_seconds" integer,
	"transcript_text" text,
	"segments" jsonb,
	"provider" text,
	"error_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcription_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_id" text NOT NULL,
	"cache_key" text NOT NULL,
	"billed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "transcription_usage_scope_created_idx" ON "transcription_usage" USING btree ("scope_id","created_at");--> statement-breakpoint
CREATE INDEX "transcription_usage_created_at_idx" ON "transcription_usage" USING btree ("created_at");