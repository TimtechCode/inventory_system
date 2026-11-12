import { db } from "@/lib/db";

/** The same PrismaClient instance the services use (DATABASE_URL points at the test database). */
export const testDb = db;

/** Deletes every row, children first, so each test starts from an empty catalogue. */
export async function resetDb(): Promise<void> {
  await db.$transaction([
    db.stockMovement.deleteMany(),
    db.variantOptionValue.deleteMany(),
    db.productAttributeValue.deleteMany(),
    db.productVariant.deleteMany(),
    db.product.deleteMany(),
    db.attributeOption.deleteMany(),
    db.attributeDefinition.deleteMany(),
    db.productType.deleteMany(),
    db.category.deleteMany(),
  ]);
}
