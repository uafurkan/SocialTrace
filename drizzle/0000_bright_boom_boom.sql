CREATE TYPE "public"."media_type" AS ENUM('image', 'video', 'reel');--> statement-breakpoint
CREATE TYPE "public"."membership_event" AS ENUM('added', 'removed');--> statement-breakpoint
CREATE TYPE "public"."membership_kind" AS ENUM('follower', 'following');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('instagram');--> statement-breakpoint
CREATE TABLE "change_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"from_snapshot_id" uuid,
	"to_snapshot_id" uuid NOT NULL,
	"membership_event" "membership_event",
	"membership_kind" "membership_kind",
	"social_user_id" uuid,
	"field" text,
	"old_value" text,
	"new_value" text,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"media_type" "media_type" NOT NULL,
	"thumbnail_url" text DEFAULT '' NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"like_count" bigint DEFAULT 0 NOT NULL,
	"comment_count" bigint DEFAULT 0 NOT NULL,
	"view_count" bigint,
	"posted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"profile_id" uuid NOT NULL,
	"social_user_id" uuid NOT NULL,
	"kind" "membership_kind" NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "memberships_profile_id_social_user_id_kind_pk" PRIMARY KEY("profile_id","social_user_id","kind")
);
--> statement-breakpoint
CREATE TABLE "profile_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"follower_count" bigint NOT NULL,
	"following_count" bigint NOT NULL,
	"post_count" bigint NOT NULL,
	"indexed_follower_count" bigint NOT NULL,
	"indexed_following_count" bigint NOT NULL,
	"follower_coverage_percent" numeric(6, 2) NOT NULL,
	"following_coverage_percent" numeric(6, 2) NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "platform" NOT NULL,
	"username" text NOT NULL,
	"normalized_username" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"avatar_url" text DEFAULT '' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"follower_count" bigint DEFAULT 0 NOT NULL,
	"following_count" bigint DEFAULT 0 NOT NULL,
	"post_count" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "platform" NOT NULL,
	"username" text NOT NULL,
	"normalized_username" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text DEFAULT '' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "change_events" ADD CONSTRAINT "change_events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_events" ADD CONSTRAINT "change_events_from_snapshot_id_profile_snapshots_id_fk" FOREIGN KEY ("from_snapshot_id") REFERENCES "public"."profile_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_events" ADD CONSTRAINT "change_events_to_snapshot_id_profile_snapshots_id_fk" FOREIGN KEY ("to_snapshot_id") REFERENCES "public"."profile_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_events" ADD CONSTRAINT "change_events_social_user_id_social_users_id_fk" FOREIGN KEY ("social_user_id") REFERENCES "public"."social_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_social_user_id_social_users_id_fk" FOREIGN KEY ("social_user_id") REFERENCES "public"."social_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_snapshots" ADD CONSTRAINT "profile_snapshots_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_events_profile_detected_at_idx" ON "change_events" USING btree ("profile_id","detected_at");--> statement-breakpoint
CREATE INDEX "media_items_profile_posted_at_idx" ON "media_items" USING btree ("profile_id","posted_at");--> statement-breakpoint
CREATE INDEX "memberships_profile_kind_idx" ON "memberships" USING btree ("profile_id","kind");--> statement-breakpoint
CREATE INDEX "profile_snapshots_profile_captured_at_idx" ON "profile_snapshots" USING btree ("profile_id","captured_at");--> statement-breakpoint
CREATE INDEX "profiles_platform_normalized_username_idx" ON "profiles" USING btree ("platform","normalized_username");--> statement-breakpoint
CREATE INDEX "social_users_platform_normalized_username_idx" ON "social_users" USING btree ("platform","normalized_username");