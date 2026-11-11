// Deterministic formatters (no Intl): identical output on the server and in every browser,
// so they are safe in client components without hydration mismatches.
// Dates are shown in West Africa Time (UTC+1, no daylight saving).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WAT_OFFSET_MS = 60 * 60 * 1000;

function toWat(iso: string): Date {
  return new Date(new Date(iso).getTime() + WAT_OFFSET_MS);
}

/** "10 Nov 2026" */
export function formatDate(iso: string): string {
  const d = toWat(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "10 Nov 2026, 14:05" */
export function formatDateTime(iso: string): string {
  const d = toWat(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${formatDate(iso)}, ${hh}:${mm}`;
}

/** "1,234" */
export function formatCount(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** plural(1, "product") → "1 product"; plural(3, "SKU") → "3 SKUs"; plural(2, "category", "categories"). */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatCount(n)} ${n === 1 ? singular : pluralForm}`;
}
