import { beforeEach, describe, expect, it } from "vitest";

import { createCategory } from "@/lib/services/categories";
import { createProductType, getProductTypeEditData } from "@/lib/services/product-types";
import { createProduct, deleteProduct, getProductEditData, updateProduct } from "@/lib/services/products";
import {
  adjustStock,
  getRecentMovements,
  listStockMovements,
  parseStockHistoryQuery,
  stockHistoryHref,
} from "@/lib/services/stock";
import type { ProductInput, ProductTypeDefinition, ServiceResult } from "@/lib/types";

import { resetDb, testDb } from "../helpers/db";

function unwrap<T>(result: ServiceResult<T>): T {
  if (!result.ok) throw new Error(`Expected ok, got ${JSON.stringify(result.error)}`);
  return result.data;
}

let type: ProductTypeDefinition;
let categoryId: string;

async function makeProduct(): Promise<{ productId: string; small: string; medium: string; input: ProductInput }> {
  const size = type.attributes[0];
  const input: ProductInput = {
    name: "Tee",
    description: "",
    categoryId,
    productTypeId: type.id,
    price: "5,000",
    attributes: {},
    axes: [size.id],
    variants: [
      { options: { [size.id]: size.options[0].id }, sku: "TEE-S", priceOverride: "", quantityOnHand: "10", reorderLevel: "2" },
      { options: { [size.id]: size.options[1].id }, sku: "TEE-M", priceOverride: "", quantityOnHand: "0", reorderLevel: "2" },
    ],
  };
  const { id } = unwrap(await createProduct(input));
  const variants = await testDb.productVariant.findMany({ where: { productId: id }, orderBy: { sku: "desc" } });
  return { productId: id, small: variants[0].id, medium: variants[1].id, input };
}

describe("stock history", () => {
  beforeEach(async () => {
    await resetDb();
    const created = unwrap(
      await createProductType({
        name: "Apparel",
        description: "",
        attributes: [
          { name: "Size", inputType: "SELECT", unit: "", isRequired: false, allowsVariants: true, options: [{ value: "S" }, { value: "M" }] },
        ],
      }),
    );
    type = (await getProductTypeEditData(created.id))!;
    categoryId = unwrap(await createCategory({ name: "Clothing", description: "" })).id;
  });

  it("records an opening movement for every SKU of a new product", async () => {
    const { productId } = await makeProduct();
    const { items, total } = await getRecentMovements(productId);
    expect(total).toBe(2);
    expect(items.map((m) => [m.sku, m.variantLabel, m.kind, m.quantityChange, m.quantityAfter])).toEqual([
      ["TEE-M", "M", "INITIAL", 0, 0],
      ["TEE-S", "S", "INITIAL", 10, 10],
    ]);
  });

  it("applies receipts, sales, returns, damage and counts", async () => {
    const { small } = await makeProduct();
    expect(unwrap(await adjustStock({ variantId: small, kind: "RECEIVED", quantity: "1,200", note: " Invoice 42 " }))).toEqual({
      quantityAfter: 1210,
      quantityChange: 1200,
      sku: "TEE-S",
    });
    expect(unwrap(await adjustStock({ variantId: small, kind: "SOLD", quantity: "10", note: "" })).quantityAfter).toBe(1200);
    expect(unwrap(await adjustStock({ variantId: small, kind: "RETURNED", quantity: "1", note: "" })).quantityAfter).toBe(1201);
    expect(unwrap(await adjustStock({ variantId: small, kind: "DAMAGED", quantity: "1", note: "" })).quantityAfter).toBe(1200);
    expect(unwrap(await adjustStock({ variantId: small, kind: "COUNT", quantity: "1195", note: "" })).quantityChange).toBe(-5);
    // A count that matches is still recorded (change 0).
    expect(unwrap(await adjustStock({ variantId: small, kind: "COUNT", quantity: "1195", note: "" })).quantityChange).toBe(0);

    const variant = await testDb.productVariant.findUnique({ where: { id: small } });
    expect(variant?.quantityOnHand).toBe(1195);

    const history = await listStockMovements(parseStockHistoryQuery({}));
    expect(history.items[0]).toMatchObject({ kind: "COUNT", quantityChange: 0, quantityAfter: 1195 });
    const received = await listStockMovements(parseStockHistoryQuery({ kind: "RECEIVED" }));
    expect(received.items.map((m) => m.note)).toEqual(["Invoice 42"]);
  });

  it("refuses to go below zero, zero-unit moves and bad input", async () => {
    const { small, medium } = await makeProduct();
    const oversell = await adjustStock({ variantId: small, kind: "SOLD", quantity: "11", note: "" });
    expect(oversell.ok).toBe(false);
    if (!oversell.ok) expect(oversell.error.fieldErrors.quantity).toMatch(/Only 10 on hand/);

    for (const quantity of ["0", "", "-1", "1.5", "abc"]) {
      const r = await adjustStock({ variantId: medium, kind: "RECEIVED", quantity, note: "" });
      expect(r.ok, quantity).toBe(false);
    }
    const missing = await adjustStock({ variantId: "nope", kind: "RECEIVED", quantity: "1", note: "" });
    expect(missing.ok).toBe(false);

    expect(await testDb.stockMovement.count()).toBe(2); // only the opening entries
  });

  it("makes open edit forms stale and logs quantity edits made on the form", async () => {
    const { productId, small, input } = await makeProduct();
    const before = (await getProductEditData(productId))!;
    unwrap(await adjustStock({ variantId: small, kind: "SOLD", quantity: "1", note: "" }));

    // The form loaded before the sale would overwrite it, so the save is refused.
    const stale = await updateProduct(productId, input, before.product.updatedAt);
    expect(stale.ok).toBe(false);

    const fresh = (await getProductEditData(productId))!;
    const [s, m] = fresh.product.variants;
    unwrap(
      await updateProduct(
        productId,
        {
          ...input,
          variants: [
            { id: s.id, options: s.options, sku: s.sku, priceOverride: "", quantityOnHand: "20", reorderLevel: "2" },
            { id: m.id, options: m.options, sku: m.sku, priceOverride: "", quantityOnHand: "0", reorderLevel: "5" },
          ],
        },
        fresh.product.updatedAt,
      ),
    );
    const { items } = await getRecentMovements(productId);
    expect(items[0]).toMatchObject({ kind: "EDIT", sku: "TEE-S", quantityChange: 11, quantityAfter: 20 });
    // Changing only the reorder level is not a stock movement.
    expect(items.filter((x) => x.kind === "EDIT")).toHaveLength(1);
  });

  it("keeps history readable after the product is deleted", async () => {
    const { productId } = await makeProduct();
    unwrap(await deleteProduct(productId));
    const all = await listStockMovements(parseStockHistoryQuery({}));
    expect(all.total).toBe(2);
    expect(all.items[0]).toMatchObject({ productId: null, productName: "Tee" });
  });

  it("parses and builds history URLs", () => {
    const q = parseStockHistoryQuery({ kind: "SOLD", page: "3", product: "abc123" });
    expect(q).toEqual({ product: "abc123", kind: "SOLD", page: 3 });
    expect(parseStockHistoryQuery({ kind: "bogus", page: "-2", product: "../x" })).toEqual({ product: null, kind: null, page: 1 });
    expect(stockHistoryHref(q, { kind: null })).toBe("/stock?product=abc123");
    expect(stockHistoryHref(q, { page: 4 })).toBe("/stock?product=abc123&kind=SOLD&page=4");
  });
});
