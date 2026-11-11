import type { PriceRange } from "@/lib/types";

// Money is integer kobo (₦1 = 100 kobo). Formatting is hand-written rather than Intl-based so
// server-rendered and hydrated output are byte-identical on every platform.

/** ₦99,999,999.99 */
export const MAX_PRICE_KOBO = 9_999_999_999;

export type NairaParseResult =
  | { ok: true; kobo: number }
  | { ok: false; reason: "empty" | "format" | "zero" | "too_large" };

/**
 * Parses a naira amount as typed by a person ("18500", "18,500", "₦18,500.50", "NGN 2,000")
 * into kobo using string arithmetic (no floating point).
 */
export function parseNairaToKobo(raw: string): NairaParseResult {
  const cleaned = raw.trim().replace(/^NGN/i, "").replace(/[₦,\s]/g, "");
  if (cleaned === "") return { ok: false, reason: "empty" };

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return { ok: false, reason: "format" };

  const whole = match[1].replace(/^0+(?=\d)/, "");
  if (whole.length > 8) return { ok: false, reason: "too_large" };

  const fraction = (match[2] ?? "").padEnd(2, "0");
  const kobo = Number(whole) * 100 + Number(fraction);
  if (kobo === 0) return { ok: false, reason: "zero" };
  if (kobo > MAX_PRICE_KOBO) return { ok: false, reason: "too_large" };
  return { ok: true, kobo };
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "18,500" or "18,500.50" (no currency sign); used to pre-fill price inputs. */
export function koboToNairaInput(kobo: number): string {
  const sign = kobo < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(kobo));
  const naira = groupThousands(String(Math.floor(abs / 100)));
  const remainder = abs % 100;
  return remainder === 0 ? `${sign}${naira}` : `${sign}${naira}.${String(remainder).padStart(2, "0")}`;
}

/** "₦18,500" or "₦18,500.50". */
export function formatNaira(kobo: number): string {
  const text = koboToNairaInput(kobo);
  return text.startsWith("-") ? `-₦${text.slice(1)}` : `₦${text}`;
}

/** "₦8,500" when min = max, otherwise "₦8,500 – ₦9,500". */
export function formatNairaRange(range: PriceRange): string {
  return range.minKobo === range.maxKobo
    ? formatNaira(range.minKobo)
    : `${formatNaira(range.minKobo)} – ${formatNaira(range.maxKobo)}`;
}

export function effectivePriceKobo(priceKobo: number, priceOverrideKobo: number | null): number {
  return priceOverrideKobo ?? priceKobo;
}

/** User-facing message for a failed price parse. */
export function priceErrorMessage(reason: Exclude<NairaParseResult, { ok: true }>["reason"]): string {
  switch (reason) {
    case "empty":
      return "Enter a sales price";
    case "format":
      return "Enter an amount in naira, like 18,500 or 18,500.50";
    case "zero":
      return "Price must be more than ₦0";
    case "too_large":
      return "Price must be ₦99,999,999.99 or less";
  }
}
