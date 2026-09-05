ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_stripe_customer_id_idx" ON "users" USING btree ("stripe_customer_id");