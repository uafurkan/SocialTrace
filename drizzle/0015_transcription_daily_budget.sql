CREATE TABLE "transcription_daily_budget" (
	"day" date PRIMARY KEY NOT NULL,
	"used" integer DEFAULT 0 NOT NULL
);