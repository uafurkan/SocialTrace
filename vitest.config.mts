import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // *.integration.test.ts files hit the real database (see
    // vitest.integration.config.mts / docs/TESTING.md) and run only via
    // `npm run test:integration` — kept out of the fast, network-free
    // default `npm test` run.
    exclude: ["**/*.integration.test.ts", "**/node_modules/**"],
  },
});
