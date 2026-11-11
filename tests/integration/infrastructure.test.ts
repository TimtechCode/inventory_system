import { io } from "next/cache";
import { beforeEach, describe, expect, it } from "vitest";

import { resetDb, testDb } from "../helpers/db";

describe("test infrastructure", () => {
  beforeEach(resetDb);

  it("talks to the migrated test database through lib/db", async () => {
    await testDb.category.create({ data: { name: "Footwear", slug: "footwear" } });
    expect(await testDb.category.count()).toBe(1);
    expect(process.env.DATABASE_URL).toMatch(/test/);
  });

  it("resolves next/cache io() outside a Next request", async () => {
    await expect(io()).resolves.toBeUndefined();
  });

  it("enforces foreign keys", async () => {
    await expect(
      testDb.product.create({
        data: { name: "Orphan", categoryId: "missing", productTypeId: "missing", priceKobo: 100 },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});
