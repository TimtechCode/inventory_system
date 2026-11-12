// Success messages shown as a toast after a server-side redirect (?notice=<code>).
// Only whitelisted codes are displayed, so the query string can't inject arbitrary text.
// Copy rule: the toast repeats the verb of the button that caused it ("Add product" → "Product added").

export const NOTICES = {
  "product-created": "Product added",
  "product-updated": "Changes saved",
  "product-deleted": "Product deleted",
  "stock-adjusted": "Stock updated",
  "category-created": "Category added",
  "category-updated": "Changes saved",
  "category-deleted": "Category deleted",
  "type-created": "Product type added",
  "type-updated": "Changes saved",
  "type-deleted": "Product type deleted",
} as const;

export type NoticeCode = keyof typeof NOTICES;

export const NOTICE_PARAM = "notice";

export function isNoticeCode(value: string | null | undefined): value is NoticeCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(NOTICES, value);
}

/** Appends ?notice=<code> to an internal path (keeps any existing query string). */
export function withNotice(href: string, code: NoticeCode): string {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}${NOTICE_PARAM}=${code}`;
}
