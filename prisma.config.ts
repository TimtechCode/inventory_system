// Prisma 7 does not load .env on its own; dotenv makes DATABASE_URL available to the CLI.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Run explicitly with `bun run db:seed`; it is safe to run repeatedly.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // process.env (not env()) so `prisma generate` still works before a .env file exists.
    url: process.env.DATABASE_URL ?? "",
  },
});
