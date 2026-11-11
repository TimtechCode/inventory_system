import "server-only";

import type { ActionResult, FormState, ServiceError } from "@/lib/types";

export function errorState(prev: FormState, error: ServiceError): FormState {
  return {
    status: "error",
    formError: error.formError,
    fieldErrors: error.fieldErrors,
    attempt: prev.attempt + 1,
  };
}

export function invalidPayload(prev: FormState): FormState {
  return errorState(prev, {
    formError: "The form could not be read. Reload the page and try again.",
    fieldErrors: {},
  });
}

export function actionFailure(error: ServiceError): ActionResult<never> {
  return { ok: false, message: error.formError ?? "Something went wrong. Try again." };
}

export function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
