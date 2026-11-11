import { z } from "zod";

import { ATTRIBUTE_INPUT_TYPES } from "@/lib/types";
import type { CategoryInput, ProductInput, ProductTypeInput } from "@/lib/types";

// Shape-only schemas for payloads arriving from the browser. They check structure (so services can
// trust the types) but not business rules: services return field-level messages for those.

const id = z.string().min(1).max(64);
const text = z.string().max(10_000);

export const categoryInputSchema = z.object({
  name: text,
  description: text,
}) satisfies z.ZodType<CategoryInput>;

export const productTypeInputSchema = z.object({
  name: text,
  description: text,
  attributes: z
    .array(
      z.object({
        id: id.optional(),
        name: text,
        inputType: z.enum(ATTRIBUTE_INPUT_TYPES),
        unit: text,
        isRequired: z.boolean(),
        allowsVariants: z.boolean(),
        options: z.array(z.object({ id: id.optional(), value: text })).max(200),
      }),
    )
    .max(50),
}) satisfies z.ZodType<ProductTypeInput>;

export const productInputSchema = z.object({
  name: text,
  description: text,
  categoryId: z.string().max(64),
  productTypeId: z.string().max(64),
  price: text,
  attributes: z.record(id, z.union([text, z.boolean()])),
  axes: z.array(id).max(10),
  variants: z
    .array(
      z.object({
        id: id.optional(),
        options: z.record(id, id),
        sku: text,
        priceOverride: text,
        quantityOnHand: text,
        reorderLevel: text,
      }),
    )
    .max(500),
}) satisfies z.ZodType<ProductInput>;

/** Parses the JSON "payload" field sent by the rich client forms. */
export function parseJsonPayload<T>(raw: FormDataEntryValue | null, schema: z.ZodType<T>): T | null {
  if (typeof raw !== "string") return null;
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
