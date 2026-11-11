import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_PRODUCT_QUERY } from "@/lib/product-query";
import { createCategory, deleteCategory, listCategories, updateCategory } from "@/lib/services/categories";
import {
  createProductType,
  deleteProductType,
  getProductTypeEditData,
  updateProductType,
} from "@/lib/services/product-types";
import {
  createProduct,
  deleteProduct,
  getProductDetail,
  getProductEditData,
  listProducts,
  updateProduct,
} from "@/lib/services/products";
import type { AttributeDefinitionInput, ProductInput, ProductTypeDefinition, ServiceResult } from "@/lib/types";

import { resetDb, testDb } from "../helpers/db";

function unwrap<T>(result: ServiceResult<T>): T {
  if (!result.ok) throw new Error(`Expected ok, got ${JSON.stringify(result.error)}`);
  return result.data;
}

async function apparelType(): Promise<ProductTypeDefinition> {
  const { id } = unwrap(
    await createProductType({
      name: "Apparel",
      description: "",
      attributes: [
        { name: "Size", inputType: "SELECT", unit: "", isRequired: false, allowsVariants: true, options: [{ value: "S" }, { value: "M" }, { value: "L" }] },
        { name: "Colour", inputType: "SELECT", unit: "", isRequired: false, allowsVariants: true, options: [{ value: "Indigo" }, { value: "Mustard" }] },
        { name: "Fabric", inputType: "TEXT", unit: "", isRequired: true, allowsVariants: false, options: [] },
        { name: "Weight", inputType: "NUMBER", unit: "g", isRequired: false, allowsVariants: false, options: [] },
      ],
    }),
  );
  const data = await getProductTypeEditData(id);
  return data!;
}

function attr(type: ProductTypeDefinition, name: string) {
  return type.attributes.find((a) => a.name === name)!;
}
function opt(type: ProductTypeDefinition, name: string, value: string) {
  return attr(type, name).options.find((o) => o.value === value)!.id;
}

describe("categories", () => {
  beforeEach(resetDb);

  it("creates with a slug, rejects case-insensitive duplicates, and blocks deleting used categories", async () => {
    const created = unwrap(await createCategory({ name: "  Bags &  Accessories ", description: "" }));
    expect(created).toMatchObject({ name: "Bags & Accessories", slug: "bags-and-accessories" });

    const dup = await createCategory({ name: "bags & accessories", description: "" });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.fieldErrors.name).toMatch(/already exists/);

    const empty = await createCategory({ name: "  ", description: "" });
    expect(empty.ok).toBe(false);

    const [row] = await listCategories();
    const renamed = await updateCategory(row.id, { name: "Bags", description: "Handbags" }, row.updatedAt);
    expect(unwrap(renamed).slug).toBe("bags-and-accessories"); // slug never changes

    const stale = await updateCategory(row.id, { name: "Bags 2", description: "" }, row.updatedAt);
    expect(stale.ok).toBe(false);

    const type = await apparelType();
    await createProduct(baseProduct(type, row.id));
    const blocked = await deleteCategory(row.id);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.formError).toMatch(/1 product/);
  });
});

function baseProduct(type: ProductTypeDefinition, categoryId: string, overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    name: "Plain Tee",
    description: "",
    categoryId,
    productTypeId: type.id,
    price: "5,000",
    attributes: { [attr(type, "Fabric").id]: "Cotton" },
    axes: [],
    variants: [{ options: {}, sku: "tee-1", priceOverride: "", quantityOnHand: "10", reorderLevel: "3" }],
    ...overrides,
  };
}

describe("products", () => {
  let type: ProductTypeDefinition;
  let categoryId: string;

  beforeEach(async () => {
    await resetDb();
    type = await apparelType();
    categoryId = unwrap(await createCategory({ name: "Clothing", description: "" })).id;
  });

  it("creates a single-SKU product with typed attribute values", async () => {
    const { id } = unwrap(
      await createProduct(baseProduct(type, categoryId, { attributes: { [attr(type, "Fabric").id]: "Cotton", [attr(type, "Weight").id]: "180" } })),
    );
    const detail = (await getProductDetail(id))!;
    expect(detail.hasVariants).toBe(false);
    expect(detail.variants).toHaveLength(1);
    expect(detail.variants[0]).toMatchObject({ sku: "TEE-1", label: "", priceKobo: 500_000, status: "in-stock" });
    expect(detail.attributes.map((a) => a.display)).toEqual(["Cotton", "180 g"]);
  });

  it("validates required attributes, prices, SKUs and duplicate combinations", async () => {
    const size = attr(type, "Size").id;
    const result = await createProduct(
      baseProduct(type, categoryId, {
        price: "abc",
        attributes: {},
        axes: [size],
        variants: [
          { options: { [size]: opt(type, "Size", "S") }, sku: "X 1", priceOverride: "", quantityOnHand: "-1", reorderLevel: "" },
          { options: { [size]: opt(type, "Size", "S") }, sku: "x-1", priceOverride: "0", quantityOnHand: "1", reorderLevel: "1" },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const e = result.error.fieldErrors;
    expect(e.price).toBeDefined();
    expect(e[`attributes.${attr(type, "Fabric").id}`]).toBeDefined();
    expect(e["variants.0.quantityOnHand"]).toBeDefined();
    expect(e["variants.1.sku"]).toMatch(/twice/);
    expect(e["variants.1.options"]).toMatch(/Same options/);
    expect(e["variants.1.priceOverride"]).toBeDefined();
  });

  it("rejects a SKU used by another product", async () => {
    unwrap(await createProduct(baseProduct(type, categoryId)));
    const clash = await createProduct(baseProduct(type, categoryId, { name: "Other" }));
    expect(clash.ok).toBe(false);
    if (!clash.ok) expect(clash.error.fieldErrors["variants.0.sku"]).toMatch(/already used by "Plain Tee"/);
  });

  it("creates variants, lists, searches, filters and sorts", async () => {
    const size = attr(type, "Size").id;
    const colour = attr(type, "Colour").id;
    const dress = unwrap(
      await createProduct(
        baseProduct(type, categoryId, {
          name: "Ankara Wrap Dress",
          price: "18,500",
          axes: [size, colour],
          variants: [
            { options: { [size]: opt(type, "Size", "M"), [colour]: opt(type, "Colour", "Indigo") }, sku: "AWD-M-IND", priceOverride: "", quantityOnHand: "2", reorderLevel: "3" },
            { options: { [size]: opt(type, "Size", "S"), [colour]: opt(type, "Colour", "Indigo") }, sku: "AWD-S-IND", priceOverride: "19,500", quantityOnHand: "8", reorderLevel: "3" },
          ],
        }),
      ),
    );
    unwrap(await createProduct(baseProduct(type, categoryId)));

    const all = await listProducts(DEFAULT_PRODUCT_QUERY);
    expect(all.items.map((p) => p.name)).toEqual(["Ankara Wrap Dress", "Plain Tee"]);
    expect(all.counts).toEqual({ all: 2, low: 1, inStock: 1 });
    const listed = all.items[0];
    expect(listed).toMatchObject({ hasVariants: true, sku: null, reorderLevel: 3, totalQuantity: 10, status: "low" });
    expect(listed.price).toEqual({ minKobo: 1_850_000, maxKobo: 1_950_000 });
    expect(listed.variants.map((v) => v.label)).toEqual(["S / Indigo", "M / Indigo"]);

    const search = await listProducts({ ...DEFAULT_PRODUCT_QUERY, q: "dress m-ind" });
    expect(search.items).toHaveLength(1);
    expect(search.items[0].variants.filter((v) => v.matchesQuery).map((v) => v.sku)).toEqual(["AWD-M-IND"]);

    const low = await listProducts({ ...DEFAULT_PRODUCT_QUERY, status: "low" });
    expect(low.items.map((p) => p.id)).toEqual([dress.id]);

    const byPrice = await listProducts({ ...DEFAULT_PRODUCT_QUERY, sort: "price", dir: "desc" });
    expect(byPrice.items[0].id).toBe(dress.id);

    const bySlug = await listProducts({ ...DEFAULT_PRODUCT_QUERY, category: "nope" });
    expect(bySlug.total).toBe(0);
    expect(bySlug.page).toBe(1);
  });

  it("updates variants (including SKU swaps), removes variants and guards stale edits", async () => {
    const size = attr(type, "Size").id;
    const { id } = unwrap(
      await createProduct(
        baseProduct(type, categoryId, {
          axes: [size],
          variants: [
            { options: { [size]: opt(type, "Size", "S") }, sku: "A", priceOverride: "", quantityOnHand: "1", reorderLevel: "0" },
            { options: { [size]: opt(type, "Size", "M") }, sku: "B", priceOverride: "", quantityOnHand: "2", reorderLevel: "0" },
            { options: { [size]: opt(type, "Size", "L") }, sku: "C", priceOverride: "", quantityOnHand: "3", reorderLevel: "0" },
          ],
        }),
      ),
    );
    const edit = (await getProductEditData(id))!;
    const [s, m] = edit.product.variants;
    const updated = await updateProduct(
      id,
      baseProduct(type, categoryId, {
        name: "Plain Tee v2",
        axes: [size],
        variants: [
          { id: s.id, options: s.options, sku: "B", priceOverride: "", quantityOnHand: "5", reorderLevel: "1" },
          { id: m.id, options: m.options, sku: "A", priceOverride: "6,000", quantityOnHand: "2", reorderLevel: "1" },
        ],
      }),
      edit.product.updatedAt,
    );
    unwrap(updated);
    const detail = (await getProductDetail(id))!;
    expect(detail.name).toBe("Plain Tee v2");
    expect(detail.variants.map((v) => [v.label, v.sku, v.priceKobo])).toEqual([
      ["S", "B", 500_000],
      ["M", "A", 600_000],
    ]);

    const stale = await updateProduct(id, baseProduct(type, categoryId), edit.product.updatedAt);
    expect(stale.ok).toBe(false);

    unwrap(await deleteProduct(id));
    expect(await testDb.productVariant.count()).toBe(0);
  });
});

describe("product types", () => {
  beforeEach(resetDb);

  it("generates attribute codes and protects attributes and options in use", async () => {
    const type = await apparelType();
    expect(type.attributes.map((a) => a.code)).toEqual(["size", "colour", "fabric", "weight"]);
    const categoryId = unwrap(await createCategory({ name: "Clothing", description: "" })).id;
    const size = attr(type, "Size");
    unwrap(
      await createProduct(
        baseProduct(type, categoryId, {
          axes: [size.id],
          variants: [{ options: { [size.id]: opt(type, "Size", "M") }, sku: "T-M", priceOverride: "", quantityOnHand: "1", reorderLevel: "0" }],
        }),
      ),
    );
    const edit = (await getProductTypeEditData(type.id))!;
    expect(edit.usage.attributes[size.id]).toEqual({ products: 0, asVariantAxis: 1 });
    expect(edit.usage.options[opt(type, "Size", "M")]).toBe(1);

    const asInput = (mutate: (attrs: ReturnType<typeof toInputs>) => void) => {
      const attributes = toInputs(edit);
      mutate(attributes);
      return { name: edit.name, description: "", attributes };
    };

    // Removing the used option "M" is refused.
    const removeOption = await updateProductType(
      type.id,
      asInput((a) => (a[0].options = a[0].options.filter((o) => o.value !== "M"))),
      edit.updatedAt,
    );
    expect(removeOption.ok).toBe(false);
    if (!removeOption.ok) expect(removeOption.error.fieldErrors["attributes.0.options"]).toMatch(/"M"/);

    // Removing an attribute in use is refused; removing an unused one works, and renames/reorders apply.
    const removeSize = await updateProductType(type.id, asInput((a) => a.splice(0, 1)), edit.updatedAt);
    expect(removeSize.ok).toBe(false);

    unwrap(
      await updateProductType(
        type.id,
        asInput((a) => {
          a.splice(3, 1); // Weight (unused)
          a[0].options.reverse();
          a[0].options[0].value = "Large";
          a.push({ name: "Sleeve", inputType: "SELECT", unit: "", isRequired: false, allowsVariants: false, options: [{ value: "Short" }, { value: "Long" }] });
        }),
        edit.updatedAt,
      ),
    );
    const after = (await getProductTypeEditData(type.id))!;
    expect(after.attributes.map((a) => a.name)).toEqual(["Size", "Colour", "Fabric", "Sleeve"]);
    expect(after.attributes[0].options.map((o) => o.value)).toEqual(["Large", "M", "S"]);

    const blocked = await deleteProductType(type.id);
    expect(blocked.ok).toBe(false);
  });
});

function toInputs(t: ProductTypeDefinition): AttributeDefinitionInput[] {
  return t.attributes.map((a) => ({
    id: a.id,
    name: a.name,
    inputType: a.inputType,
    unit: a.unit ?? "",
    isRequired: a.isRequired,
    allowsVariants: a.allowsVariants,
    options: a.options.map((o) => ({ id: o.id, value: o.value })),
  }));
}
