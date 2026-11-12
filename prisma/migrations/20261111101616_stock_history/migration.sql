-- CreateTable
CREATE TABLE "StockMovement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" TEXT,
    "variantId" TEXT,
    "productName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_variantId_createdAt_idx" ON "StockMovement"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_kind_idx" ON "StockMovement"("kind");

-- Backfill: one opening-balance movement per existing SKU so every SKU's history starts from
-- its current quantity. Labels follow attribute order (e.g. "M / Indigo").
INSERT INTO "StockMovement" ("productId", "variantId", "productName", "sku", "variantLabel", "kind", "quantityChange", "quantityAfter", "note", "createdAt")
SELECT
    p."id",
    v."id",
    p."name",
    v."sku",
    COALESCE((
        SELECT group_concat("value", ' / ') FROM (
            SELECT o."value" AS "value"
            FROM "VariantOptionValue" vo
            JOIN "AttributeOption" o ON o."id" = vo."optionId"
            JOIN "AttributeDefinition" a ON a."id" = vo."attributeId"
            WHERE vo."variantId" = v."id"
            ORDER BY a."position"
        )
    ), ''),
    'INITIAL',
    v."quantityOnHand",
    v."quantityOnHand",
    'Opening balance',
    p."updatedAt"
FROM "ProductVariant" v
JOIN "Product" p ON p."id" = v."productId";
