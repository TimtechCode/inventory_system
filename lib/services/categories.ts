import "server-only";

import { io } from "next/cache";

import { db } from "@/lib/db";
import { slugify, uniqueWithSuffix } from "@/lib/slug";
import type { CategoryInput, CategoryListItem, CategoryOption, FieldErrors, ServiceResult } from "@/lib/types";

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

export const CATEGORY_NAME_MAX = 60;
export const DESCRIPTION_MAX = 500;

export async function listCategories(): Promise<CategoryListItem[]> {
  await io();
  const rows = await db.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    productCount: c._count.products,
    updatedAt: c.updatedAt.toISOString(),
  }));
}

export async function getCategoryOptions(): Promise<CategoryOption[]> {
  await io();
  return db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });
}

export async function getCategory(id: string): Promise<CategoryListItem | null> {
  await io();
  const c = await db.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    productCount: c._count.products,
    updatedAt: c.updatedAt.toISOString(),
  };
}

async function validate(
  input: CategoryInput,
  excludeId: string | null,
): Promise<Validated<{ name: string; description: string | null }>> {
  const errors: FieldErrors = {};
  const name = cleanText(input.name);
  const description = cleanMultiline(input.description);

  if (name === "") errors.name = "Enter a category name";
  else if (name.length > CATEGORY_NAME_MAX) errors.name = `Use ${CATEGORY_NAME_MAX} characters or fewer`;
  if (description && description.length > DESCRIPTION_MAX) {
    errors.description = `Use ${DESCRIPTION_MAX} characters or fewer`;
  }

  if (!errors.name) {
    const all = await db.category.findMany({ select: { id: true, name: true } });
    if (all.some((c) => c.id !== excludeId && nameKey(c.name) === nameKey(name))) {
      errors.name = `A category called "${name}" already exists`;
    }
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: { name, description } };
}

export async function createCategory(input: CategoryInput): Promise<ServiceResult<CategoryOption>> {
  const validated = await validate(input, null);
  if (!validated.ok) return fail(FIX_BELOW, validated.errors);
  const result = validated.value;

  const taken = new Set((await db.category.findMany({ select: { slug: true } })).map((c) => c.slug));
  try {
    const created = await db.category.create({
      data: { name: result.name, description: result.description, slug: uniqueWithSuffix(slugify(result.name), taken) },
      select: { id: true, name: true, slug: true },
    });
    return ok(created);
  } catch (error) {
    if (prismaCode(error) === "P2002") return fail(FIX_BELOW, { name: `A category called "${result.name}" already exists` });
    throw error;
  }
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
  expectedUpdatedAt: string | null,
): Promise<ServiceResult<CategoryOption>> {
  const existing = await db.category.findUnique({ where: { id } });
  if (!existing) return fail(NOT_FOUND);
  if (expectedUpdatedAt && existing.updatedAt.toISOString() !== expectedUpdatedAt) return fail(STALE);

  const validated = await validate(input, id);
  if (!validated.ok) return fail(FIX_BELOW, validated.errors);
  const result = validated.value;

  try {
    const updated = await db.category.update({
      where: { id },
      data: { name: result.name, description: result.description },
      select: { id: true, name: true, slug: true },
    });
    return ok(updated);
  } catch (error) {
    if (prismaCode(error) === "P2002") return fail(FIX_BELOW, { name: `A category called "${result.name}" already exists` });
    if (prismaCode(error) === "P2025") return fail(NOT_FOUND);
    throw error;
  }
}

export async function deleteCategory(id: string): Promise<ServiceResult<{ name: string }>> {
  const existing = await db.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!existing) return fail(NOT_FOUND);
  const count = existing._count.products;
  if (count > 0) {
    return fail(
      `"${existing.name}" still has ${count === 1 ? "1 product" : `${count} products`}. Move or delete them first.`,
    );
  }
  try {
    await db.category.delete({ where: { id } });
  } catch (error) {
    if (prismaCode(error) === "P2003") return fail(`"${existing.name}" is still used by products.`);
    if (prismaCode(error) === "P2025") return fail(NOT_FOUND);
    throw error;
  }
  return ok({ name: existing.name });
}
