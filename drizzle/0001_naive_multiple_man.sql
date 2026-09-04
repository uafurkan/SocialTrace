DROP INDEX "profiles_platform_normalized_username_idx";--> statement-breakpoint
DROP INDEX "social_users_platform_normalized_username_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_platform_normalized_username_idx" ON "profiles" USING btree ("platform","normalized_username");--> statement-breakpoint
CREATE UNIQUE INDEX "social_users_platform_normalized_username_idx" ON "social_users" USING btree ("platform","normalized_username");