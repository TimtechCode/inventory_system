import "server-only";

import { io } from "next/cache";

import { db } from "@/lib/db";
import { attributeCode, slugify, uniqueWithSuffix } from "@/lib/slug";
import type {
  AttributeDefinitionDTO,
  AttributeUsage,
  FieldErrors,
  ProductTypeDefinition,
  ProductTypeEditData,
  ProductTypeInput,
  ProductTypeListItem,
  ProductTypeOption,
  ServiceResult,
} from "@/lib/types";

import { DESCRIPTION_MAX } from "./categories";
import {
  FIX_BELOW,
  NOT_FOUND,
  STALE,
  type Validated,
  cleanMultiline,
  cleanText,
  fail,
  nameKey,
  ok,
  prismaCode,
} from "./shared";

export const TYPE_NAME_MAX = 60;
export const ATTRIBUTE_NAME_MAX = 40;
export const OPTION_VALUE_MAX = 40;
export const UNIT_MAX = 10;

const attributeInclude = {
  attributes: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } } } },
} as const;

type AttributeRow = {
  id: string;
  code: string;
  name: string;
  inputType: AttributeDefinitionDTO["inputType"];
  unit: string | null;
  isRequired: boolean;
  allowsVariants: boolean;
  position: number;
  options: { id: string; value: string; position: number }[];
};

export function toAttributeDTO(a: AttributeRow): AttributeDefinitionDTO {
  return {
    id: a.id,
    code: a.code,
    name: a.name,
    inputType: a.inputType,
    unit: a.unit,
    isRequired: a.isRequired,
    allowsVariants: a.allowsVariants,
    position: a.position,
    options: a.options.map((o) => ({ id: o.id, value: o.value, position: o.position })),
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listProductTypes(): Promise<ProductTypeListItem[]> {
  await io();
  const rows = await db.productType.findMany({
    orderBy: { name: "asc" },
    include: {
      attributes: { orderBy: { position: "asc" }, select: { name: true, allowsVariants: true } },
      _count: { select: { products: true } },
    },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description,
    attributeNames: t.attributes.map((a) => a.name),
    variantAttributeNames: t.attributes.filter((a) => a.allowsVariants).map((a) => a.name),
    productCount: t._count.products,
    updatedAt: t.updatedAt.toISOString(),
  }));
}

export async function getProductTypeOptions(): Promise<ProductTypeOption[]> {
  await io();
  return db.productType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });
}

export async function getProductTypeDefinitions(): Promise<ProductTypeDefinition[]> {
  await io();
  const rows = await db.productType.findMany({ orderBy: { name: "asc" }, include: attributeInclude });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description,
    attributes: t.attributes.map(toAttributeDTO),
  }));
}

async function computeUsage(attributeIds: string[]): Promise<ProductTypeEditData["usage"]> {
  const [values, axes] = await Promise.all([
    db.productAttributeValue.findMany({
      where: { attributeId: { in: attributeIds } },
      select: { productId: true, attributeId: true, optionId: true },
    }),
    db.variantOptionValue.findMany({
      where: { attributeId: { in: attributeIds } },
      select: { attributeId: true, optionId: true, variant: { select: { productId: true } } },
    }),
  ]);

  const attrProducts = new Map<string, Set<string>>();
  const attrAxis = new Map<string, Set<string>>();
  const optionProducts = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, key: string, productId: string) => {
    let set = map.get(key);
    if (!set) map.set(key, (set = new Set()));
    set.add(productId);
  };

  for (const v of values) {
    add(attrProducts, v.attributeId, v.productId);
    if (v.optionId) add(optionProducts, v.optionId, v.productId);
  }
  for (const v of axes) {
    add(attrAxis, v.attributeId, v.variant.productId);
    add(optionProducts, v.optionId, v.variant.productId);
  }

  const attributes: Record<string, AttributeUsage> = {};
  for (const id of attributeIds) {
    attributes[id] = { products: attrProducts.get(id)?.size ?? 0, asVariantAxis: attrAxis.get(id)?.size ?? 0 };
  }
  const options: Record<string, number> = {};
  for (const [optionId, set] of optionProducts) options[optionId] = set.size;
  return { attributes, options };
}

export async function getProductTypeEditData(id: string): Promise<ProductTypeEditData | null> {
  await io();
  const t = await db.productType.findUnique({
    where: { id },
    include: { ...attributeInclude, _count: { select: { products: true } } },
  });
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description,
    attributes: t.attributes.map(toAttributeDTO),
    productCount: t._count.products,
    updatedAt: t.updatedAt.toISOString(),
    usage: await computeUsage(t.attributes.map((a) => a.id)),
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

type CleanAttribute = {
  id?: string;
  name: string;
  inputType: AttributeDefinitionDTO["inputType"];
  unit: string | null;
  isRequired: boolean;
  allowsVariants: boolean;
  options: { id?: string; value: string }[];
};

type CleanType = { name: string; description: string | null; attributes: CleanAttribute[] };

async function validate(input: ProductTypeInput, excludeId: string | null): Promise<Validated<CleanType>> {
  const errors: FieldErrors = {};
  const name = cleanText(input.name);
  const description = cleanMultiline(input.description);

  if (name === "") errors.name = "Enter a name for this product type";
  else if (name.length > TYPE_NAME_MAX) errors.name = `Use ${TYPE_NAME_MAX} characters or fewer`;
  if (description && description.length > DESCRIPTION_MAX) {
    errors.description = `Use ${DESCRIPTION_MAX} characters or fewer`;
  }
  if (!errors.name) {
    const all = await db.productType.findMany({ select: { id: true, name: true } });
    if (all.some((t) => t.id !== excludeId && nameKey(t.name) === nameKey(name))) {
      errors.name = `A product type called "${name}" already exists`;
    }
  }

  const seenNames = new Map<string, number>();
  const attributes: CleanAttribute[] = input.attributes.map((raw, i) => {
    const path = `attributes.${i}`;
    const attrName = cleanText(raw.name);
    if (attrName === "") errors[`${path}.name`] = "Enter an attribute name";
    else if (attrName.length > ATTRIBUTE_NAME_MAX) errors[`${path}.name`] = `Use ${ATTRIBUTE_NAME_MAX} characters or fewer`;
    else if (seenNames.has(nameKey(attrName))) errors[`${path}.name`] = `"${attrName}" is already used by another attribute`;
    else seenNames.set(nameKey(attrName), i);

    const isSelect = raw.inputType === "SELECT";
    const unit = raw.inputType === "NUMBER" ? cleanText(raw.unit) || null : null;
    if (unit && unit.length > UNIT_MAX) errors[`${path}.unit`] = `Use ${UNIT_MAX} characters or fewer`;

    const options: { id?: string; value: string }[] = [];
    if (isSelect) {
      const seen = new Set<string>();
      raw.options.forEach((o, j) => {
        const value = cleanText(o.value);
        if (value === "") {
          // A blank row with no id is simply ignored; a blank existing option is an error.
          if (o.id) errors[`${path}.options.${j}`] = "Enter a value or remove this option";
          return;
        }
        if (value.length > OPTION_VALUE_MAX) {
          errors[`${path}.options.${j}`] = `Use ${OPTION_VALUE_MAX} characters or fewer`;
        } else if (seen.has(value.toLowerCase())) {
          errors[`${path}.options.${j}`] = `"${value}" is listed twice`;
        }
        seen.add(value.toLowerCase());
        options.push({ id: o.id, value });
      });
      if (options.length === 0) errors[`${path}.options`] = "Add at least one option";
    }

    return {
      id: raw.id,
      name: attrName,
      inputType: raw.inputType,
      unit,
      isRequired: raw.isRequired,
      allowsVariants: isSelect && raw.allowsVariants,
      options,
    };
  });

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, value: { name, description, attributes } };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createProductType(input: ProductTypeInput): Promise<ServiceResult<ProductTypeOption>> {
  const validated = await validate(input, null);
  if (!validated.ok) return fail(FIX_BELOW, validated.errors);
  const clean = validated.value;

  const taken = new Set((await db.productType.findMany({ select: { slug: true } })).map((t) => t.slug));
  const codes = new Set<string>();
  try {
    const created = await db.productType.create({
      data: {
        name: clean.name,
        slug: uniqueWithSuffix(slugify(clean.name), taken),
        description: clean.description,
        attributes: {
          create: clean.attributes.map((a, position) => {
            const code = uniqueWithSuffix(attributeCode(a.name), codes, "_");
            codes.add(code);
            return {
              code,
              name: a.name,
              inputType: a.inputType,
              unit: a.unit,
              isRequired: a.isRequired,
              allowsVariants: a.allowsVariants,
              position,
              options: { create: a.options.map((o, i) => ({ value: o.value, position: i })) },
            };
          }),
        },
      },
      select: { id: true, name: true, slug: true },
    });
    return ok(created);
  } catch (error) {
    if (prismaCode(error) === "P2002") return fail(FIX_BELOW, { name: `A product type called "${clean.name}" already exists` });
    throw error;
  }
}

export async function updateProductType(
  id: string,
  input: ProductTypeInput,
  expectedUpdatedAt: string | null,
): Promise<ServiceResult<ProductTypeOption>> {
  const existing = await db.productType.findUnique({ where: { id }, include: attributeInclude });
  if (!existing) return fail(NOT_FOUND);
  if (expectedUpdatedAt && existing.updatedAt.toISOString() !== expectedUpdatedAt) return fail(STALE);

  const validated = await validate(input, id);
  if (!validated.ok) return fail(FIX_BELOW, validated.errors);
  const clean = validated.value;

  const byId = new Map(existing.attributes.map((a) => [a.id, a]));
  for (const a of clean.attributes) {
    if (a.id && !byId.has(a.id)) return fail(STALE);
    const current = a.id ? byId.get(a.id) : undefined;
    if (current) {
      const optionIds = new Set(current.options.map((o) => o.id));
      if (a.options.some((o) => o.id && !optionIds.has(o.id))) return fail(STALE);
    }
  }

  // Guard changes that would invalidate products already using an attribute or option.
  const usage = await computeUsage(existing.attributes.map((a) => a.id));
  const errors: FieldErrors = {};
  const keptIds = new Set(clean.attributes.flatMap((a) => (a.id ? [a.id] : [])));
  const removedInUse = existing.attributes.filter((a) => {
    const u = usage.attributes[a.id];
    return !keptIds.has(a.id) && (u.products > 0 || u.asVariantAxis > 0);
  });

  clean.attributes.forEach((a, i) => {
    const current = a.id ? byId.get(a.id) : undefined;
    if (!current) return;
    const u = usage.attributes[current.id];
    const inUse = u.products > 0 || u.asVariantAxis > 0;
    if (inUse && current.inputType !== a.inputType) {
      errors[`attributes.${i}.inputType`] =
        `Can't change the type: ${plainCount(Math.max(u.products, u.asVariantAxis))} already use "${current.name}"`;
    }
    if (u.asVariantAxis > 0 && current.allowsVariants && !a.allowsVariants) {
      errors[`attributes.${i}.allowsVariants`] =
        `${plainCount(u.asVariantAxis)} use "${current.name}" to define SKUs. Remove those variants first.`;
    }
    if (a.inputType === "SELECT") {
      const keptOptions = new Set(a.options.flatMap((o) => (o.id ? [o.id] : [])));
      const removedOptions = current.options.filter((o) => !keptOptions.has(o.id) && (usage.options[o.id] ?? 0) > 0);
      if (removedOptions.length > 0) {
        errors[`attributes.${i}.options`] =
          `Can't remove ${removedOptions.map((o) => `"${o.value}"`).join(", ")}: still used by products`;
      }
    }
  });

  if (removedInUse.length > 0 || Object.keys(errors).length > 0) {
    const formError =
      removedInUse.length > 0
        ? `Can't remove ${removedInUse.map((a) => `"${a.name}"`).join(", ")}: products of this type still use ${removedInUse.length === 1 ? "it" : "them"}.`
        : FIX_BELOW;
    return fail(formError, errors);
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.productType.update({
        where: { id },
        data: { name: clean.name, description: clean.description },
      });

      const removed = existing.attributes.filter((a) => !keptIds.has(a.id)).map((a) => a.id);
      if (removed.length > 0) await tx.attributeDefinition.deleteMany({ where: { id: { in: removed } } });

      // Two-phase rename so swapping names (or option values) never trips a unique index.
      for (const a of clean.attributes) {
        if (!a.id) continue;
        await tx.attributeDefinition.update({ where: { id: a.id }, data: { name: `\u0000${a.id}` } });
      }
      // Option values must be unique per attribute; give each a unique temporary value.
      for (const a of clean.attributes) {
        if (!a.id) continue;
        const current = byId.get(a.id)!;
        for (const o of current.options) {
          await tx.attributeOption.update({ where: { id: o.id }, data: { value: `\u0000${o.id}` } });
        }
      }

      const codes = new Set(existing.attributes.filter((a) => keptIds.has(a.id)).map((a) => a.code));
      for (const [position, a] of clean.attributes.entries()) {
        const data = {
          name: a.name,
          inputType: a.inputType,
          unit: a.unit,
          isRequired: a.isRequired,
          allowsVariants: a.allowsVariants,
          position,
        };
        let attributeId: string;
        if (a.id) {
          attributeId = a.id;
          await tx.attributeDefinition.update({ where: { id: a.id }, data });
        } else {
          const code = uniqueWithSuffix(attributeCode(a.name), codes, "_");
          codes.add(code);
          attributeId = (await tx.attributeDefinition.create({ data: { ...data, code, productTypeId: id } })).id;
        }

        const current = a.id ? byId.get(a.id) : undefined;
        const keptOptionIds = new Set(a.options.flatMap((o) => (o.id ? [o.id] : [])));
        const removedOptionIds = (current?.options ?? []).filter((o) => !keptOptionIds.has(o.id)).map((o) => o.id);
        if (removedOptionIds.length > 0) {
          await tx.attributeOption.deleteMany({ where: { id: { in: removedOptionIds } } });
        }
        for (const [i, o] of a.options.entries()) {
          if (o.id) await tx.attributeOption.update({ where: { id: o.id }, data: { value: o.value, position: i } });
          else await tx.attributeOption.create({ data: { attributeId, value: o.value, position: i } });
        }
      }
    });
  } catch (error) {
    const code = prismaCode(error);
    if (code === "P2002") return fail(FIX_BELOW, { name: `A product type called "${clean.name}" already exists` });
    if (code === "P2003") return fail("Some of these attributes or options are now used by products. Reload and try again.");
    if (code === "P2025") return fail(STALE);
    throw error;
  }

  return ok({ id, name: clean.name, slug: existing.slug });
}

export async function deleteProductType(id: string): Promise<ServiceResult<{ name: string }>> {
  const existing = await db.productType.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!existing) return fail(NOT_FOUND);
  const count = existing._count.products;
  if (count > 0) {
    return fail(`"${existing.name}" is used by ${plainCount(count)}. Delete those products first.`);
  }
  try {
    await db.productType.delete({ where: { id } });
  } catch (error) {
    if (prismaCode(error) === "P2003") return fail(`"${existing.name}" is still used by products.`);
    if (prismaCode(error) === "P2025") return fail(NOT_FOUND);
    throw error;
  }
  return ok({ name: existing.name });
}

function plainCount(n: number): string {
  return n === 1 ? "1 product" : `${n} products`;
}
