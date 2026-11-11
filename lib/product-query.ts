// Parsing and building of the products list URL (?q=&category=&type=&status=&sort=&dir=&page=).
// Client-safe: used by the server page and by the client filter controls.

import { PRODUCT_SORTS, STOCK_STATUSES } from "@/lib/types";
import type { ProductListQuery, ProductSort, SortDirection, StockStatus } from "@/lib/types";

export const PRODUCT_PAGE_SIZE = 20;
export const SEARCH_MAX = 100;

export const SORT_LABELS: Record<ProductSort, string> = {
  name: "Name",
  category: "Category",
  quantity: "Quantity",
  price: "Price",
  status: "Stock status",
  updated: "Last updated",
};

/** Direction used when a column is first chosen. */
export function defaultDirection(sort: ProductSort): SortDirection {
  return sort === "updated" ? "desc" : "asc";
}

export const DEFAULT_PRODUCT_QUERY: ProductListQuery = {
  q: "",
  category: null,
  type: null,
  status: null,
  sort: "name",
  dir: "asc",
  page: 1,
};

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

function first(params: RawParams, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

const SLUG = /^[a-z0-9-]{1,80}$/;

export function parseProductListQuery(params: RawParams): ProductListQuery {
  const q = (first(params, "q") ?? "").replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX);
  const category = first(params, "category");
  const type = first(params, "type");
  const status = first(params, "status");
  const sortRaw = first(params, "sort");
  const sort: ProductSort = (PRODUCT_SORTS as readonly string[]).includes(sortRaw ?? "")
    ? (sortRaw as ProductSort)
    : "name";
  const dirRaw = first(params, "dir");
  const dir: SortDirection = dirRaw === "asc" || dirRaw === "desc" ? dirRaw : defaultDirection(sort);
  const pageNum = Number.parseInt(first(params, "page") ?? "1", 10);

  return {
    q,
    category: category && SLUG.test(category) ? category : null,
    type: type && SLUG.test(type) ? type : null,
    status: (STOCK_STATUSES as readonly string[]).includes(status ?? "") ? (status as StockStatus) : null,
    sort,
    dir,
    page: Number.isFinite(pageNum) && pageNum >= 1 ? Math.min(pageNum, 10_000) : 1,
  };
}

/**
 * "/products?…" for a query, omitting defaults so URLs stay short and shareable.
 * Changing anything other than `page` resets to page 1.
 */
export function productListHref(query: ProductListQuery, changes: Partial<ProductListQuery> = {}): string {
  const resetsPage = Object.keys(changes).some((k) => k !== "page");
  const next: ProductListQuery = { ...query, ...(resetsPage ? { page: 1 } : {}), ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category) params.set("category", next.category);
  if (next.type) params.set("type", next.type);
  if (next.status) params.set("status", next.status);
  if (next.sort !== "name") params.set("sort", next.sort);
  if (next.dir !== defaultDirection(next.sort)) params.set("dir", next.dir);
  if (next.page > 1) params.set("page", String(next.page));
  const search = params.toString();
  return search ? `/products?${search}` : "/products";
}

export function hasActiveFilters(query: ProductListQuery): boolean {
  return Boolean(query.q || query.category || query.type || query.status);
}
