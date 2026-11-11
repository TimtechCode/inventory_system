import { ArrowDown, ArrowUp, ArrowUpDown, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { StockBadge, StockMeter } from "@/components/stock";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, Skeleton } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { formatCount, formatDate, plural } from "@/lib/format";
import { formatNairaRange } from "@/lib/money";
import { defaultDirection, hasActiveFilters, parseProductListQuery, productListHref } from "@/lib/product-query";
import { getCategoryOptions } from "@/lib/services/categories";
import { getProductTypeOptions } from "@/lib/services/product-types";
import { getStockOverview, listProducts } from "@/lib/services/products";
import type { ProductListItem, ProductListQuery, ProductSort } from "@/lib/types";

import { ProductFilters } from "./product-filters";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <>
      <PageHeader
        title="Products"
        description={
          <Suspense fallback={<span>&nbsp;</span>}>
            <Overview />
          </Suspense>
        }
        actions={
          <LinkButton href="/products/new">
            <Plus aria-hidden />
            Add product
          </LinkButton>
        }
      />
      <Panel>
        <Suspense fallback={<Skeleton rows={8} />}>
          <ProductResults searchParams={searchParams} />
        </Suspense>
      </Panel>
    </>
  );
}

async function Overview() {
  const o = await getStockOverview();
  return (
    <span>
      {plural(o.products, "product")} · {plural(o.skus, "SKU")} · {plural(o.units, "unit")} on hand
      {o.lowSkus > 0 && (
        <>
          {" · "}
          <Link href="/products?status=low" className="font-medium text-clay-ink underline-offset-2 hover:underline">
            {plural(o.lowSkus, "SKU")} low
          </Link>
        </>
      )}
    </span>
  );
}

async function ProductResults({ searchParams }: Pick<PageProps<"/products">, "searchParams">) {
  const query = parseProductListQuery(await searchParams);
  const [result, categories, productTypes] = await Promise.all([
    listProducts(query),
    getCategoryOptions(),
    getProductTypeOptions(),
  ]);
  const q = result.query;
  const first = (result.page - 1) * result.pageSize + 1;
  const last = first + result.items.length - 1;

  return (
    <>
      <ProductFilters query={q} counts={result.counts} categories={categories} productTypes={productTypes} />
      {result.items.length === 0 ? (
        hasActiveFilters(q) ? (
          <EmptyState title="No products match these filters">
            <Link href="/products" className="font-medium text-sage underline-offset-2 hover:underline">
              Clear filters
            </Link>
          </EmptyState>
        ) : (
          <EmptyState title="No products yet">
            <Link href="/products/new" className="font-medium text-sage underline-offset-2 hover:underline">
              Add your first product
            </Link>
          </EmptyState>
        )
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <caption className="sr-only">
                Products{q.q ? ` matching “${q.q}”` : ""}, sorted by {q.sort} {q.dir === "asc" ? "ascending" : "descending"}
              </caption>
              <thead className="border-b border-line text-left text-ink-muted">
                <tr>
                  <SortHeader query={q} sort="name" label="Product" />
                  <SortHeader query={q} sort="category" label="Category" />
                  <SortHeader query={q} sort="quantity" label="On hand" />
                  <SortHeader query={q} sort="price" label="Price" align="right" />
                  <SortHeader query={q} sort="status" label="Status" />
                  <SortHeader query={q} sort="updated" label="Updated" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.items.map((p) => (
                  <ProductRow key={p.id} product={p} searching={q.q !== ""} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-ink-muted">
            <p>
              Showing <span className="tabular">{formatCount(first)}</span>–<span className="tabular">{formatCount(last)}</span> of{" "}
              {plural(result.total, "product")}
            </p>
            {result.pageCount > 1 && (
              <nav aria-label="Pagination" className="flex items-center gap-2">
                <PageLink query={q} page={result.page - 1} disabled={result.page <= 1} label="Previous" />
                <span className="tabular">
                  Page {result.page} of {result.pageCount}
                </span>
                <PageLink query={q} page={result.page + 1} disabled={result.page >= result.pageCount} label="Next" />
              </nav>
            )}
          </div>
        </>
      )}
    </>
  );
}

function SortHeader({
  query,
  sort,
  label,
  align = "left",
}: {
  query: ProductListQuery;
  sort: ProductSort;
  label: string;
  align?: "left" | "right";
}) {
  const active = query.sort === sort;
  const dir = active ? (query.dir === "asc" ? "desc" : "asc") : defaultDirection(sort);
  const Icon = !active ? ArrowUpDown : query.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (query.dir === "asc" ? "ascending" : "descending") : undefined}
      className={cn("px-4 py-2.5 font-medium", align === "right" && "text-right")}
    >
      <Link
        href={productListHref(query, { sort, dir })}
        className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}
      >
        {label}
        <Icon aria-hidden className={cn("size-3.5", !active && "opacity-40")} />
      </Link>
    </th>
  );
}

function ProductRow({ product: p, searching }: { product: ProductListItem; searching: boolean }) {
  const matched = searching && !p.nameMatchesQuery ? p.variants.filter((v) => v.matchesQuery) : [];
  return (
    <tr className="align-top hover:bg-paper/60">
      <td className="px-4 py-3">
        <Link href={`/products/${p.id}`} className="font-medium text-ink hover:text-sage hover:underline">
          {p.name}
        </Link>
        <div className="mt-0.5 text-ink-muted">
          {p.hasVariants ? plural(p.variantCount, "variant") : <span className="font-mono text-xs">{p.sku}</span>}
          {" · "}
          {p.productType.name}
        </div>
        {matched.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-1">
            {matched.slice(0, 4).map((v) => (
              <li key={v.id} className="rounded-badge bg-sage-soft px-2 py-0.5 text-xs text-sage-strong">
                <span className="font-mono">{v.sku}</span> {v.label}
              </li>
            ))}
            {matched.length > 4 && <li className="text-xs text-ink-muted">+{matched.length - 4} more</li>}
          </ul>
        )}
      </td>
      <td className="px-4 py-3 text-ink-muted">{p.category.name}</td>
      <td className="px-4 py-3">
        <StockMeter quantity={p.totalQuantity} reorderLevel={p.reorderLevel ?? 0} status={p.status} />
        <div className="mt-0.5 pl-12 text-xs text-ink-muted">
          {p.reorderLevel === null ? "Reorder level varies" : `Reorder at ${formatCount(p.reorderLevel)}`}
        </div>
      </td>
      <td className="tabular px-4 py-3 text-right">{formatNairaRange(p.price)}</td>
      <td className="px-4 py-3">
        <StockBadge status={p.status} />
        {p.hasVariants && p.lowStockCount > 0 && (
          <div className="mt-1 text-xs text-clay-ink">
            {formatCount(p.lowStockCount)} of {plural(p.variantCount, "SKU")} low
          </div>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{formatDate(p.updatedAt)}</td>
    </tr>
  );
}

function PageLink({ query, page, disabled, label }: { query: ProductListQuery; page: number; disabled: boolean; label: string }) {
  if (disabled) {
    return (
      <span aria-disabled="true" className={buttonClass("secondary", "sm", "pointer-events-none opacity-50")}>
        {label}
      </span>
    );
  }
  return (
    <Link href={productListHref(query, { page })} className={buttonClass("secondary", "sm")}>
      {label}
    </Link>
  );
}
