"use server";

import { redirect } from "next/navigation";

import { actionFailure, errorState, invalidPayload, stringField } from "@/lib/actions/state";
import { withNotice } from "@/lib/notices";
import { createProduct, deleteProduct, updateProduct } from "@/lib/services/products";
import type { ActionResult, FormState } from "@/lib/types";
import { parseJsonPayload, productInputSchema } from "@/lib/validation/schemas";

export async function createProductAction(prev: FormState, formData: FormData): Promise<FormState> {
  const input = parseJsonPayload(formData.get("payload"), productInputSchema);
  if (!input) return invalidPayload(prev);
  const result = await createProduct(input);
  if (!result.ok) return errorState(prev, result.error);
  redirect(withNotice(`/products/${result.data.id}`, "product-created"));
}

export async function updateProductAction(id: string, prev: FormState, formData: FormData): Promise<FormState> {
  const input = parseJsonPayload(formData.get("payload"), productInputSchema);
  if (!input) return invalidPayload(prev);
  const result = await updateProduct(id, input, stringField(formData, "updatedAt") || null);
  if (!result.ok) return errorState(prev, result.error);
  redirect(withNotice(`/products/${id}`, "product-updated"));
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  const result = await deleteProduct(id);
  if (!result.ok) return actionFailure(result.error);
  redirect(withNotice("/products", "product-deleted"));
}
