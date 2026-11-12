"use server";

import { refresh } from "next/cache";

import { errorState, stringField } from "@/lib/actions/state";
import { adjustStock } from "@/lib/services/stock";
import type { AdjustmentKind, FormState } from "@/lib/types";

export async function adjustStockAction(variantId: string, prev: FormState, formData: FormData): Promise<FormState> {
  const result = await adjustStock({
    variantId,
    kind: stringField(formData, "kind") as AdjustmentKind,
    quantity: stringField(formData, "quantity"),
    note: stringField(formData, "note"),
  });
  if (!result.ok) return errorState(prev, result.error);
  refresh();
  return { status: "success", formError: null, fieldErrors: {}, attempt: prev.attempt + 1 };
}
