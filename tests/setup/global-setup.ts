import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

/** Creates a fresh, fully migrated SQLite database for the test run. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "file:./prisma/test.db";
  if (!url.startsWith("file:")) {
    throw new Error(`TEST_DATABASE_URL must be a SQLite file URL, got "${url}"`);
  }
  const file = path.resolve(process.cwd(), url.slice("file:".length));
  // Guard against wiping a real database by mistake.
  if (!path.basename(file).includes("test")) {
    throw new Error(`Refusing to reset "${file}": test database file names must contain "test".`);
  }
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(`${file}${suffix}`, { force: true });
  }
  execFileSync(path.resolve("node_modules/.bin/prisma"), ["migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    stdio: "pipe",
  });
}
