// URL slugs and machine codes generated from human names. Both are fixed at creation time.

function asciiWords(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** "Bags & Accessories" → "bags-and-accessories". Falls back to "item" for names with no letters. */
export function slugify(value: string): string {
  return asciiWords(value).join("-").slice(0, 60).replace(/-+$/, "") || "item";
}

/** "Shoe size (EU)" → "shoe_size_eu". */
export function attributeCode(value: string): string {
  return asciiWords(value).join("_").slice(0, 40).replace(/_+$/, "") || "attribute";
}

/** Returns base, or base + separator + n (n = 2, 3, …), whichever is not taken. */
export function uniqueWithSuffix(base: string, taken: ReadonlySet<string>, separator = "-"): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}${separator}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Normalises a SKU as typed: trimmed, upper-case, inner whitespace replaced by "-". */
export function normalizeSku(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "-");
}

export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,39}$/;

/**
 * Suggested SKU for a product and its variant option values, e.g.
 * ("Ankara Wrap Dress", ["M", "Indigo"]) → "ANKARA-WRAP-DRESS-M-INDIGO" (capped to 40 chars).
 */
export function suggestSku(productName: string, optionValues: readonly string[] = []): string {
  const head = asciiWords(productName).join("-").toUpperCase().slice(0, 24).replace(/-+$/, "") || "SKU";
  const tail = optionValues
    .map((v) => asciiWords(v).join("").toUpperCase().slice(0, 8))
    .filter(Boolean);
  return [head, ...tail].join("-").slice(0, 40).replace(/-+$/, "");
}
