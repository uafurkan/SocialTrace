import { defineConfig } from "vitest/config";

/**
 * Separate config (not vitest.config.mts) so `npm test` stays fast and
 * network-free — these tests hit the real database from .env.local (see
 * docs/TESTING.md's "Integration tests" section for why: the user chose
 * the real dev DB over pg-mem specifically because pg-mem runs a
 * different driver than production and wouldn't have caught the
 * drizzle-orm/neon-http join bug found in docs/DECISIONS.md).
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    setupFiles: ["./vitest.integration.setup.ts"],
    testTimeout: 20_000,
    fileParallelism: false,
  },
});
