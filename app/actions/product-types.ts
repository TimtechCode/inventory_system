"use server";

import { redirect } from "next/navigation";

import { actionFailure, errorState, invalidPayload, stringField } from "@/lib/actions/state";
import { withNotice } from "@/lib/notices";
import { createProductType, deleteProductType, updateProductType } from "@/lib/services/product-types";
import type { ActionResult, FormState } from "@/lib/types";
import { parseJsonPayload, productTypeInputSchema } from "@/lib/validation/schemas";

export async function createProductTypeAction(prev: FormState, formData: FormData): Promise<FormState> {
  const input = parseJsonPayload(formData.get("payload"), productTypeInputSchema);
  if (!input) return invalidPayload(prev);
  const result = await createProductType(input);
  if (!result.ok) return errorState(prev, result.error);
  redirect(withNotice("/types", "type-created"));
}

export async function updateProductTypeAction(id: string, prev: FormState, formData: FormData): Promise<FormState> {
  const input = parseJsonPayload(formData.get("payload"), productTypeInputSchema);
  if (!input) return invalidPayload(prev);
  const result = await updateProductType(id, input, stringField(formData, "updatedAt") || null);
  if (!result.ok) return errorState(prev, result.error);
  redirect(withNotice("/types", "type-updated"));
}

export async function deleteProductTypeAction(id: string): Promise<ActionResult> {
  const result = await deleteProductType(id);
  if (!result.ok) return actionFailure(result.error);
  redirect(withNotice("/types", "type-deleted"));
}
