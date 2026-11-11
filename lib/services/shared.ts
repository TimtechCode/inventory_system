import "server-only";

import { MAX_STOCK_QUANTITY } from "@/lib/stock";
import type { FieldErrors, ServiceResult } from "@/lib/types";

export type Validated<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

export function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export function fail(formError: string | null, fieldErrors: FieldErrors = {}): ServiceResult<never> {
  return { ok: false, error: { formError, fieldErrors } };
}

export const NOT_FOUND = "This record no longer exists. It may have been deleted.";
export const STALE =
  "Someone else changed this record while you were editing. Reload the page to see their changes, then try again.";
export const FIX_BELOW = "Fix the highlighted fields and try again.";

/** Prisma error code check without importing the generated runtime error classes. */
export function prismaCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

/** Collapses inner whitespace and trims. */
export function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Trims; keeps line breaks (for descriptions). Returns null when empty. */
export function cleanMultiline(value: string): string | null {
  const trimmed = value.replace(/\r\n/g, "\n").trim();
  return trimmed === "" ? null : trimmed;
}

export type IntParse = { ok: true; value: number } | { ok: false; message: string };

/** Whole number 0..MAX_STOCK_QUANTITY, as typed (commas allowed). */
export function parseStockInt(raw: string, label: string, emptyAs: number | null = null): IntParse {
  const cleaned = raw.trim().replace(/,/g, "");
  if (cleaned === "") {
    return emptyAs === null ? { ok: false, message: `Enter ${label}` } : { ok: true, value: emptyAs };
  }
  if (!/^\d+$/.test(cleaned)) return { ok: false, message: `${capitalise(label)} must be a whole number, 0 or more` };
  const value = Number(cleaned);
  if (value > MAX_STOCK_QUANTITY) {
    return { ok: false, message: `${capitalise(label)} must be ${MAX_STOCK_QUANTITY.toLocaleString("en-US")} or less` };
  }
  return { ok: true, value };
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Case-insensitive name comparison key. */
export function nameKey(value: string): string {
  return cleanText(value).toLowerCase();
}
