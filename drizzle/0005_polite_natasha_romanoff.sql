CREATE TABLE "profile_cache" (
	"platform" "platform" NOT NULL,
	"normalized_username" text NOT NULL,
	"data" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_cache_platform_normalized_username_pk" PRIMARY KEY("platform","normalized_username")
);
