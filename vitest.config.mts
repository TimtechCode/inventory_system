import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

// Each test run migrates a throwaway SQLite file. Override with TEST_DATABASE_URL to run
// several suites side by side (e.g. TEST_DATABASE_URL=file:./prisma/test-a.db).
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? "file:./prisma/test.db";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: root },
      // `server-only` throws outside Next's server bundle; tests exercise server modules directly.
      { find: /^server-only$/, replacement: `${root}tests/stubs/server-only.ts` },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/setup/global-setup.ts"],
    // Integration suites share one SQLite file, so files run one at a time.
    fileParallelism: false,
    env: { DATABASE_URL: testDatabaseUrl },
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
