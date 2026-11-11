import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a production build on port 3100, backed by a freshly migrated and
// seeded SQLite file (prisma/e2e.db) so they never touch the development database.
const PORT = 3100;
const DATABASE_URL = "file:./prisma/e2e.db";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run e2e:db && bun run build && bun run start:e2e",
    url: `http://localhost:${PORT}/products`,
    env: { DATABASE_URL },
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
