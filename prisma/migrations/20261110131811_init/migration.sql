-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProductType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AttributeDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productTypeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inputType" TEXT NOT NULL,
    "unit" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "allowsVariants" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AttributeDefinition_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttributeOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AttributeOption_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "AttributeDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "productTypeId" TEXT NOT NULL,
    "priceKobo" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Product_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductAttributeValue" (
    "productId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "textValue" TEXT,
    "numberValue" REAL,
    "booleanValue" BOOLEAN,
    "optionId" TEXT,

    PRIMARY KEY ("productId", "attributeId"),
    CONSTRAINT "ProductAttributeValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductAttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "AttributeDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductAttributeValue_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "AttributeOption" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "optionKey" TEXT NOT NULL DEFAULT '',
    "priceOverrideKobo" INTEGER,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VariantOptionValue" (
    "variantId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    PRIMARY KEY ("variantId", "attributeId"),
    CONSTRAINT "VariantOptionValue_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VariantOptionValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "AttributeDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VariantOptionValue_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "AttributeOption" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_name_key" ON "ProductType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_slug_key" ON "ProductType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeDefinition_productTypeId_code_key" ON "AttributeDefinition"("productTypeId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeDefinition_productTypeId_name_key" ON "AttributeDefinition"("productTypeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeOption_attributeId_value_key" ON "AttributeOption"("attributeId", "value");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_productTypeId_idx" ON "Product"("productTypeId");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_attributeId_idx" ON "ProductAttributeValue"("attributeId");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_optionId_idx" ON "ProductAttributeValue"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_optionKey_key" ON "ProductVariant"("productId", "optionKey");

-- CreateIndex
CREATE INDEX "VariantOptionValue_attributeId_idx" ON "VariantOptionValue"("attributeId");

-- CreateIndex
CREATE INDEX "VariantOptionValue_optionId_idx" ON "VariantOptionValue"("optionId");
