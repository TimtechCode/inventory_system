"use server";

import { redirect } from "next/navigation";

import { actionFailure, errorState, stringField } from "@/lib/actions/state";
import { withNotice } from "@/lib/notices";
import { createCategory, deleteCategory, updateCategory } from "@/lib/services/categories";
import type { ActionResult, FormState } from "@/lib/types";

function readInput(formData: FormData) {
  return { name: stringField(formData, "name"), description: stringField(formData, "description") };
}

export async function createCategoryAction(prev: FormState, formData: FormData): Promise<FormState> {
  const result = await createCategory(readInput(formData));
  if (!result.ok) return errorState(prev, result.error);
  redirect(withNotice("/categories", "category-created"));
}

export async function updateCategoryAction(id: string, prev: FormState, formData: FormData): Promise<FormState> {
  const result = await updateCategory(id, readInput(formData), stringField(formData, "updatedAt") || null);
  if (!result.ok) return errorState(prev, result.error);
  redirect(withNotice("/categories", "category-updated"));
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const result = await deleteCategory(id);
  if (!result.ok) return actionFailure(result.error);
  redirect(withNotice("/categories", "category-deleted"));
}
