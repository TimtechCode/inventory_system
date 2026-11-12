import "server-only";

import { io } from "next/cache";

import { db } from "@/lib/db";
import { effectivePriceKobo, parseNairaToKobo, priceErrorMessage } from "@/lib/money";
import { PRODUCT_PAGE_SIZE } from "@/lib/product-query";
import { SKU_PATTERN, normalizeSku } from "@/lib/slug";
import { stockStatus, summarizeStock } from "@/lib/stock";
import type {
  AttributeDefinitionDTO,
  FieldErrors,
  PriceRange,
  ProductAttributeDisplay,
  ProductDetail,
  ProductEditData,
  ProductFormOptions,
  ProductFormSource,
  ProductInput,
  ProductListItem,
  ProductListQuery,
  ProductListResult,
  ProductTypeDefinition,
  ServiceResult,
  VariantRow,
} from "@/lib/types";

import { DESCRIPTION_MAX, getCategoryOptions } from "./categories";
import { type MovementDraft, recordMovements } from "./stock";
import { getProductTypeDefinitions, toAttributeDTO } from "./product-types";
import {
  FIX_BELOW,
  NOT_FOUND,
  STALE,
  type Validated,
  cleanMultiline,
  cleanText,
  fail,
  ok,
  parseStockInt,
  prismaCode,
} from "./shared";

export const PRODUCT_NAME_MAX = 120;
export const TEXT_VALUE_MAX = 200;
export const MAX_AXES = 3;
export const MAX_VARIANTS = 200;

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

const variantInclude = {
  optionValues: {
    include: {
      attribute: { select: { id: true, name: true, position: true } },
      option: { select: { id: true, value: true, position: true } },
    },
  },
} as const;

type VariantRecord = {
  id: string;
  sku: string;
  optionKey: string;
  priceOverrideKobo: number | null;
  quantityOnHand: number;
  reorderLevel: number;
  optionValues: {
    attribute: { id: string; name: string; position: number };
    option: { id: string; value: string; position: number };
  }[];
};

function toVariantRow(v: VariantRecord, productPriceKobo: number): VariantRow & { sortKey: number[] } {
  const ordered = [...v.optionValues].sort((a, b) => a.attribute.position - b.attribute.position);
  return {
    id: v.id,
    sku: v.sku,
    label: ordered.map((o) => o.option.value).join(" / "),
    options: ordered.map((o) => ({
      attributeId: o.attribute.id,
      attributeName: o.attribute.name,
      optionId: o.option.id,
      value: o.option.value,
    })),
    priceKobo: effectivePriceKobo(productPriceKobo, v.priceOverrideKobo),
    priceOverrideKobo: v.priceOverrideKobo,
    quantityOnHand: v.quantityOnHand,
    reorderLevel: v.reorderLevel,
    status: stockStatus(v.quantityOnHand, v.reorderLevel),
    sortKey: ordered.map((o) => o.option.position),
  };
}

function compareSortKeys(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
}

function orderedVariants(variants: VariantRecord[], priceKobo: number): VariantRow[] {
  return variants
    .map((v) => toVariantRow(v, priceKobo))
    .sort((a, b) => compareSortKeys(a.sortKey, b.sortKey) || a.sku.localeCompare(b.sku))
    .map((row) => {
      const { sortKey, ...rest } = row;
      void sortKey;
      return rest;
    });
}

function priceRange(variants: VariantRow[], fallback: number): PriceRange {
  if (variants.length === 0) return { minKobo: fallback, maxKobo: fallback };
  let min = Infinity;
  let max = -Infinity;
  for (const v of variants) {
    min = Math.min(min, v.priceKobo);
    max = Math.max(max, v.priceKobo);
  }
  return { minKobo: min, maxKobo: max };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

function tokens(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "en", { sensitivity: "base", numeric: true });
}

export async function listProducts(query: ProductListQuery): Promise<ProductListResult> {
  await io();
  const rows = await db.product.findMany({
    where: {
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.type ? { productType: { slug: query.type } } : {}),
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      productType: { select: { id: true, name: true, slug: true } },
      variants: { include: variantInclude },
    },
  });

  const terms = tokens(query.q);
  const matched: ProductListItem[] = [];
  for (const p of rows) {
    const variants = orderedVariants(p.variants, p.priceKobo);
    const productHay = `${p.name} ${p.category.name} ${p.productType.name}`.toLowerCase();
    const nameMatchesQuery = terms.length > 0 && terms.every((t) => productHay.includes(t));

    const flagged = variants.map((v) => {
      if (terms.length === 0) return { ...v, matchesQuery: false };
      const variantHay = `${v.sku} ${v.label}`.toLowerCase();
      const matchesQuery =
        terms.some((t) => variantHay.includes(t)) &&
        terms.every((t) => variantHay.includes(t) || productHay.includes(t));
      return { ...v, matchesQuery };
    });

    if (terms.length > 0 && !nameMatchesQuery && !flagged.some((v) => v.matchesQuery)) continue;

    const summary = summarizeStock(variants);
    const levels = new Set(variants.map((v) => v.reorderLevel));
    const hasVariants = variants.some((v) => v.options.length > 0);
    matched.push({
      ...summary,
      id: p.id,
      name: p.name,
      category: p.category,
      productType: p.productType,
      hasVariants,
      sku: hasVariants ? null : (variants[0]?.sku ?? null),
      reorderLevel: levels.size === 1 ? [...levels][0] : null,
      price: priceRange(variants, p.priceKobo),
      updatedAt: p.updatedAt.toISOString(),
      nameMatchesQuery,
      variants: flagged,
    });
  }

  const counts = {
    all: matched.length,
    low: matched.filter((p) => p.status === "low").length,
    inStock: matched.filter((p) => p.status === "in-stock").length,
  };
  const filtered = query.status ? matched.filter((p) => p.status === query.status) : matched;

  const sign = query.dir === "asc" ? 1 : -1;
  const byName = (a: ProductListItem, b: ProductListItem) => compareText(a.name, b.name) || a.id.localeCompare(b.id);
  filtered.sort((a, b) => {
    let d = 0;
    switch (query.sort) {
      case "name":
        d = compareText(a.name, b.name);
        break;
      case "category":
        d = compareText(a.category.name, b.category.name);
        break;
      case "quantity":
        d = a.totalQuantity - b.totalQuantity;
        break;
      case "price":
        d = a.price.minKobo - b.price.minKobo || a.price.maxKobo - b.price.maxKobo;
        break;
      case "status":
        // Ascending puts low stock first (the useful default), most low SKUs first.
        d = (a.status === "low" ? 0 : 1) - (b.status === "low" ? 0 : 1) || b.lowStockCount - a.lowStockCount;
        break;
      case "updated":
        d = a.updatedAt.localeCompare(b.updatedAt);
        break;
    }
    return d * sign || byName(a, b);
  });

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PRODUCT_PAGE_SIZE));
  const page = Math.min(Math.max(query.page, 1), pageCount);
  const start = (page - 1) * PRODUCT_PAGE_SIZE;

  return {
    items: filtered.slice(start, start + PRODUCT_PAGE_SIZE),
    query: { ...query, page },
    total,
    page,
    pageSize: PRODUCT_PAGE_SIZE,
    pageCount,
    counts,
  };
}

/** Catalogue-wide totals for the page header. */
export async function getStockOverview(): Promise<{ products: number; skus: number; lowSkus: number; units: number }> {
  await io();
  const variants = await db.productVariant.findMany({ select: { quantityOnHand: true, reorderLevel: true } });
  const products = await db.product.count();
  const summary = summarizeStock(variants);
  return { products, skus: summary.variantCount, lowSkus: summary.lowStockCount, units: summary.totalQuantity };
}

// ---------------------------------------------------------------------------
// Detail and edit data
// ---------------------------------------------------------------------------

function formatNumberValue(n: number): string {
  if (Number.isInteger(n)) return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return String(Math.round(n * 1000) / 1000);
}

export async function getProductDetail(id: string): Promise<ProductDetail | null> {
  await io();
  const p = await db.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      productType: { select: { id: true, name: true, slug: true } },
      variants: { include: variantInclude },
      attributeValues: {
        include: {
          attribute: { select: { id: true, name: true, inputType: true, unit: true, position: true } },
          option: { select: { value: true } },
        },
      },
    },
  });
  if (!p) return null;

  const variants = orderedVariants(p.variants, p.priceKobo);
  const attributes: ProductAttributeDisplay[] = [...p.attributeValues]
    .sort((a, b) => a.attribute.position - b.attribute.position)
    .flatMap((v) => {
      let display: string | null = null;
      switch (v.attribute.inputType) {
        case "TEXT":
          display = v.textValue;
          break;
        case "NUMBER":
          display =
            v.numberValue === null
              ? null
              : `${formatNumberValue(v.numberValue)}${v.attribute.unit ? ` ${v.attribute.unit}` : ""}`;
          break;
        case "BOOLEAN":
          display = v.booleanValue === null ? null : v.booleanValue ? "Yes" : "No";
          break;
        case "SELECT":
          display = v.option?.value ?? null;
          break;
      }
      return display === null
        ? []
        : [{ attributeId: v.attribute.id, name: v.attribute.name, inputType: v.attribute.inputType, display }];
    });

  const axes = variants[0]?.options.map((o) => ({ attributeId: o.attributeId, name: o.attributeName })) ?? [];

  return {
    ...summarizeStock(variants),
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    productType: p.productType,
    priceKobo: p.priceKobo,
    price: priceRange(variants, p.priceKobo),
    hasVariants: axes.length > 0,
    axes,
    attributes,
    variants,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function getProductFormOptions(): Promise<ProductFormOptions> {
  const [categories, productTypes] = await Promise.all([getCategoryOptions(), getProductTypeDefinitions()]);
  return { categories, productTypes };
}

export async function getProductEditData(id: string): Promise<ProductEditData | null> {
  await io();
  const p = await db.product.findUnique({
    where: { id },
    include: {
      variants: { include: variantInclude },
      attributeValues: true,
      productType: {
        include: {
          attributes: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } } } },
        },
      },
    },
  });
  if (!p) return null;

  const variants = orderedVariants(p.variants, p.priceKobo);
  const attributes: ProductFormSource["attributes"] = {};
  for (const v of p.attributeValues) {
    attributes[v.attributeId] = {
      textValue: v.textValue,
      numberValue: v.numberValue,
      booleanValue: v.booleanValue,
      optionId: v.optionId,
    };
  }

  const productType: ProductTypeDefinition = {
    id: p.productType.id,
    name: p.productType.name,
    slug: p.productType.slug,
    description: p.productType.description,
    attributes: p.productType.attributes.map(toAttributeDTO),
  };

  return {
    product: {
      id: p.id,
      updatedAt: p.updatedAt.toISOString(),
      name: p.name,
      description: p.description ?? "",
      categoryId: p.categoryId,
      productTypeId: p.productTypeId,
      priceKobo: p.priceKobo,
      attributes,
      axes: variants[0]?.options.map((o) => o.attributeId) ?? [],
      variants: variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        options: Object.fromEntries(v.options.map((o) => [o.attributeId, o.optionId])),
        priceOverrideKobo: v.priceOverrideKobo,
        quantityOnHand: v.quantityOnHand,
        reorderLevel: v.reorderLevel,
      })),
    },
    categories: await getCategoryOptions(),
    productType,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

type CleanValue = {
  attributeId: string;
  textValue: string | null;
  numberValue: number | null;
  booleanValue: boolean | null;
  optionId: string | null;
};

type CleanVariant = {
  id?: string;
  sku: string;
  optionKey: string;
  options: { attributeId: string; optionId: string }[];
  priceOverrideKobo: number | null;
  quantityOnHand: number;
  reorderLevel: number;
};

type CleanProduct = {
  name: string;
  description: string | null;
  categoryId: string;
  productTypeId: string;
  priceKobo: number;
  values: CleanValue[];
  variants: CleanVariant[];
};

export function optionKeyFor(options: Record<string, string>): string {
  return Object.entries(options)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([attributeId, optionId]) => `${attributeId}:${optionId}`)
    .join("|");
}

function parseNumberValue(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && Math.abs(n) < 1e12 ? n : null;
}

async function validateProduct(
  input: ProductInput,
  productType: ProductTypeDefinition | null,
  productId: string | null,
): Promise<Validated<CleanProduct>> {
  const errors: FieldErrors = {};

  const name = cleanText(input.name);
  if (name === "") errors.name = "Enter a product name";
  else if (name.length > PRODUCT_NAME_MAX) errors.name = `Use ${PRODUCT_NAME_MAX} characters or fewer`;

  const description = cleanMultiline(input.description);
  if (description && description.length > DESCRIPTION_MAX * 4) {
    errors.description = `Use ${DESCRIPTION_MAX * 4} characters or fewer`;
  }

  const category = input.categoryId ? await db.category.findUnique({ where: { id: input.categoryId } }) : null;
  if (!category) errors.categoryId = input.categoryId ? "That category no longer exists" : "Choose a category";

  if (!productType) errors.productTypeId = input.productTypeId ? "That product type no longer exists" : "Choose a product type";

  const price = parseNairaToKobo(input.price);
  if (!price.ok) errors.price = priceErrorMessage(price.reason);

  if (!productType) return { ok: false, errors };

  const attrs = new Map<string, AttributeDefinitionDTO>(productType.attributes.map((a) => [a.id, a]));

  // Variant axes
  const axes = [...new Set(input.axes)];
  for (const axisId of axes) {
    const a = attrs.get(axisId);
    if (!a || a.inputType !== "SELECT" || !a.allowsVariants) {
      errors.axes = "One of the chosen variant attributes is no longer available. Reload the page.";
    }
  }
  if (axes.length > MAX_AXES) errors.axes = `Use at most ${MAX_AXES} variant attributes`;
  const axisSet = new Set(axes);

  // Product-level attribute values
  const values: CleanValue[] = [];
  for (const key of Object.keys(input.attributes)) {
    if (!attrs.has(key)) {
      errors.attributes = "This product type has changed. Reload the page and try again.";
    }
  }
  for (const a of productType.attributes) {
    if (axisSet.has(a.id)) continue;
    const path = `attributes.${a.id}`;
    const raw = input.attributes[a.id];
    const empty = raw === undefined || raw === "" || (a.inputType !== "BOOLEAN" && typeof raw === "boolean");
    if (empty) {
      if (a.isRequired) {
        errors[path] = a.inputType === "SELECT" ? `Choose a ${a.name.toLowerCase()}` : `Enter ${a.name.toLowerCase()}`;
      }
      continue;
    }
    const base = { attributeId: a.id, textValue: null, numberValue: null, booleanValue: null, optionId: null };
    switch (a.inputType) {
      case "TEXT": {
        const text = cleanText(String(raw));
        if (text === "") {
          if (a.isRequired) errors[path] = `Enter ${a.name.toLowerCase()}`;
        } else if (text.length > TEXT_VALUE_MAX) errors[path] = `Use ${TEXT_VALUE_MAX} characters or fewer`;
        else values.push({ ...base, textValue: text });
        break;
      }
      case "NUMBER": {
        const n = parseNumberValue(String(raw));
        if (n === null) errors[path] = `${a.name} must be a number`;
        else values.push({ ...base, numberValue: n });
        break;
      }
      case "BOOLEAN": {
        const b = raw === true || raw === "true" ? true : raw === false || raw === "false" ? false : null;
        if (b === null) errors[path] = `Choose yes or no`;
        else values.push({ ...base, booleanValue: b });
        break;
      }
      case "SELECT": {
        const option = a.options.find((o) => o.id === raw);
        if (!option) errors[path] = `Choose a ${a.name.toLowerCase()} from the list`;
        else values.push({ ...base, optionId: option.id });
        break;
      }
    }
  }

  // Variants
  const variants: CleanVariant[] = [];
  if (axes.length === 0) {
    if (input.variants.length !== 1 || Object.keys(input.variants[0].options).length > 0) {
      errors.variants = "A product without variants has exactly one SKU";
    }
  } else if (input.variants.length === 0) {
    errors.variants = "Add at least one variant";
  } else if (input.variants.length > MAX_VARIANTS) {
    errors.variants = `Use at most ${MAX_VARIANTS} variants`;
  }

  const seenKeys = new Map<string, number>();
  const seenSkus = new Map<string, number>();
  input.variants.forEach((v, i) => {
    const path = `variants.${i}`;
    const sku = normalizeSku(v.sku);
    if (sku === "") errors[`${path}.sku`] = "Enter a SKU";
    else if (!SKU_PATTERN.test(sku)) {
      errors[`${path}.sku`] = "Use up to 40 letters, numbers, dots, dashes or underscores";
    } else if (seenSkus.has(sku)) errors[`${path}.sku`] = `SKU ${sku} is used twice in this form`;
    else seenSkus.set(sku, i);

    const options: { attributeId: string; optionId: string }[] = [];
    if (axes.length > 0) {
      const keys = Object.keys(v.options);
      if (keys.length !== axes.length || !keys.every((k) => axisSet.has(k))) {
        errors[`${path}.options`] = "Choose a value for every variant attribute";
      } else {
        for (const axisId of axes) {
          const optionId = v.options[axisId];
          const option = attrs.get(axisId)?.options.find((o) => o.id === optionId);
          if (!option) errors[`${path}.options`] = "Choose a value for every variant attribute";
          else options.push({ attributeId: axisId, optionId });
        }
      }
    }
    const optionKey = axes.length === 0 ? "" : optionKeyFor(v.options);
    if (!errors[`${path}.options`]) {
      if (seenKeys.has(optionKey)) {
        errors[`${path}.options`] = `Same options as variant ${seenKeys.get(optionKey)! + 1}`;
      } else seenKeys.set(optionKey, i);
    }

    let priceOverrideKobo: number | null = null;
    if (v.priceOverride.trim() !== "") {
      if (axes.length === 0) errors[`${path}.priceOverride`] = "Set the price on the product instead";
      else {
        const p = parseNairaToKobo(v.priceOverride);
        if (!p.ok) errors[`${path}.priceOverride`] = priceErrorMessage(p.reason);
        else if (price.ok && p.kobo === price.kobo) priceOverrideKobo = null;
        else priceOverrideKobo = p.kobo;
      }
    }

    const qty = parseStockInt(v.quantityOnHand, "quantity", 0);
    if (!qty.ok) errors[`${path}.quantityOnHand`] = qty.message;
    const reorder = parseStockInt(v.reorderLevel, "reorder level", 0);
    if (!reorder.ok) errors[`${path}.reorderLevel`] = reorder.message;

    variants.push({
      id: v.id,
      sku,
      optionKey,
      options,
      priceOverrideKobo,
      quantityOnHand: qty.ok ? qty.value : 0,
      reorderLevel: reorder.ok ? reorder.value : 0,
    });
  });

  // SKUs must be unique across the whole catalogue.
  const skus = [...seenSkus.keys()];
  if (skus.length > 0) {
    const clashes = await db.productVariant.findMany({
      where: { sku: { in: skus }, ...(productId ? { productId: { not: productId } } : {}) },
      select: { sku: true, product: { select: { name: true } } },
    });
    for (const c of clashes) {
      errors[`variants.${seenSkus.get(c.sku)}.sku`] = `SKU ${c.sku} is already used by "${c.product.name}"`;
    }
  }

  if (Object.keys(errors).length > 0 || !price.ok || !category) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      description,
      categoryId: category.id,
      productTypeId: productType.id,
      priceKobo: price.kobo,
      values,
      variants,
    },
  };
}

async function loadTypeDefinition(id: string): Promise<ProductTypeDefinition | null> {
  if (!id) return null;
  const t = await db.productType.findUnique({
    where: { id },
    include: { attributes: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } } } } },
  });
  return t
    ? { id: t.id, name: t.name, slug: t.slug, description: t.description, attributes: t.attributes.map(toAttributeDTO) }
    : null;
}

/** "M / Indigo" from a variant's options, in the product type's attribute order. */
function labelFor(options: { attributeId: string; optionId: string }[], type: ProductTypeDefinition): string {
  return type.attributes
    .flatMap((a) => {
      const chosen = options.find((o) => o.attributeId === a.id);
      const value = chosen ? a.options.find((o) => o.id === chosen.optionId)?.value : undefined;
      return value ? [value] : [];
    })
    .join(" / ");
}

function skuClash(error: unknown): boolean {
  if (prismaCode(error) !== "P2002") return false;
  return JSON.stringify((error as { meta?: unknown }).meta ?? "").includes("sku") || String(error).includes("sku");
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createProduct(input: ProductInput): Promise<ServiceResult<{ id: string }>> {
  const productType = await loadTypeDefinition(input.productTypeId);
  const validated = await validateProduct(input, productType, null);
  if (!validated.ok) return fail(FIX_BELOW, validated.errors);
  const clean = validated.value;

  try {
    const created = await db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: clean.name,
          description: clean.description,
          categoryId: clean.categoryId,
          productTypeId: clean.productTypeId,
          priceKobo: clean.priceKobo,
          attributeValues: { create: clean.values.map(({ attributeId, ...rest }) => ({ attributeId, ...rest })) },
        },
        select: { id: true },
      });
      const movements: MovementDraft[] = [];
      for (const v of clean.variants) {
        const variant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: v.sku,
            optionKey: v.optionKey,
            priceOverrideKobo: v.priceOverrideKobo,
            quantityOnHand: v.quantityOnHand,
            reorderLevel: v.reorderLevel,
            optionValues: { create: v.options },
          },
          select: { id: true },
        });
        movements.push({
          productId: product.id,
          variantId: variant.id,
          productName: clean.name,
          sku: v.sku,
          variantLabel: labelFor(v.options, productType!),
          kind: "INITIAL",
          quantityChange: v.quantityOnHand,
          quantityAfter: v.quantityOnHand,
        });
      }
      await recordMovements(tx, movements);
      return product;
    });
    return ok(created);
  } catch (error) {
    if (skuClash(error)) return fail("One of these SKUs was just taken by another product. Choose a different SKU.");
    if (prismaCode(error) === "P2003") return fail("The category, type or an option was just removed. Reload and try again.");
    throw error;
  }
}

export async function updateProduct(
  id: string,
  input: ProductInput,
  expectedUpdatedAt: string | null,
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.product.findUnique({
    where: { id },
    include: { variants: { select: { id: true, quantityOnHand: true } } },
  });
  if (!existing) return fail(NOT_FOUND);
  if (expectedUpdatedAt && existing.updatedAt.toISOString() !== expectedUpdatedAt) return fail(STALE);
  if (input.productTypeId !== existing.productTypeId) {
    return fail("A product's type can't be changed. Create a new product instead.");
  }

  const ownIds = new Set(existing.variants.map((v) => v.id));
  if (input.variants.some((v) => v.id && !ownIds.has(v.id))) return fail(STALE);

  const productType = await loadTypeDefinition(existing.productTypeId);
  const validated = await validateProduct(input, productType, id);
  if (!validated.ok) return fail(FIX_BELOW, validated.errors);
  const clean = validated.value;

  try {
    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          name: clean.name,
          description: clean.description,
          categoryId: clean.categoryId,
          priceKobo: clean.priceKobo,
        },
      });

      await tx.productAttributeValue.deleteMany({ where: { productId: id } });
      if (clean.values.length > 0) {
        await tx.productAttributeValue.createMany({
          data: clean.values.map((v) => ({ productId: id, ...v })),
        });
      }

      const keep = new Set(clean.variants.flatMap((v) => (v.id ? [v.id] : [])));
      const remove = [...ownIds].filter((vid) => !keep.has(vid));
      if (remove.length > 0) await tx.productVariant.deleteMany({ where: { id: { in: remove } } });

      // Two-phase update: move kept SKUs out of the way so swaps don't trip unique indexes.
      for (const vid of keep) {
        await tx.productVariant.update({
          where: { id: vid },
          data: { sku: `\u0000${vid}`, optionKey: `\u0000${vid}` },
        });
      }

      const before = new Map(existing.variants.map((v) => [v.id, v.quantityOnHand]));
      const movements: MovementDraft[] = [];
      for (const v of clean.variants) {
        const data = {
          sku: v.sku,
          optionKey: v.optionKey,
          priceOverrideKobo: v.priceOverrideKobo,
          quantityOnHand: v.quantityOnHand,
          reorderLevel: v.reorderLevel,
        };
        const movement = {
          productId: id,
          productName: clean.name,
          sku: v.sku,
          variantLabel: labelFor(v.options, productType!),
          quantityAfter: v.quantityOnHand,
        };
        if (v.id) {
          await tx.variantOptionValue.deleteMany({ where: { variantId: v.id } });
          await tx.productVariant.update({
            where: { id: v.id },
            data: { ...data, optionValues: { create: v.options } },
          });
          const change = v.quantityOnHand - (before.get(v.id) ?? 0);
          if (change !== 0) {
            movements.push({ ...movement, variantId: v.id, kind: "EDIT", quantityChange: change, note: "Changed on the product form" });
          }
        } else {
          const created = await tx.productVariant.create({
            data: { ...data, productId: id, optionValues: { create: v.options } },
            select: { id: true },
          });
          movements.push({ ...movement, variantId: created.id, kind: "INITIAL", quantityChange: v.quantityOnHand });
        }
      }
      await recordMovements(tx, movements);
    });
  } catch (error) {
    if (skuClash(error)) return fail("One of these SKUs was just taken by another product. Choose a different SKU.");
    if (prismaCode(error) === "P2003") return fail("The category or an option was just removed. Reload and try again.");
    if (prismaCode(error) === "P2025") return fail(NOT_FOUND);
    throw error;
  }
  return ok({ id });
}

export async function deleteProduct(id: string): Promise<ServiceResult<{ name: string }>> {
  const existing = await db.product.findUnique({ where: { id }, select: { name: true } });
  if (!existing) return fail(NOT_FOUND);
  try {
    await db.product.delete({ where: { id } });
  } catch (error) {
    if (prismaCode(error) === "P2025") return fail(NOT_FOUND);
    throw error;
  }
  return ok({ name: existing.name });
}
