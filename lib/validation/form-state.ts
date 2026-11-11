import type { FormState } from "@/lib/types";

// Kept outside the 'use server' action files, which may only export async functions.
export const initialFormState: FormState = {
  status: "idle",
  formError: null,
  fieldErrors: {},
  attempt: 0,
};
