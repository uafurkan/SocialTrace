DROP INDEX IF EXISTS "users_stripe_customer_id_idx";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "stripe_customer_id" TO "paddle_customer_id";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "stripe_subscription_id" TO "paddle_subscription_id";--> statement-breakpoint
CREATE UNIQUE INDEX "users_paddle_customer_id_idx" ON "users" USING btree ("paddle_customer_id");
