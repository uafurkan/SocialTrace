import { config } from "dotenv";

// `vitest` doesn't load Next.js's .env.local the way `next dev`/`next build`
// do — this is the one place that needs to happen for src/lib/db's
// getDb()/isDbConfigured() to see the real DATABASE_URL.
config({ path: ".env.local" });
