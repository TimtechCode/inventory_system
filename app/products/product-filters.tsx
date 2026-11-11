"use client";

import { Search, X } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { useRef } from "react";

import { buttonClass } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { SEARCH_MAX, defaultDirection, hasActiveFilters, productListHref } from "@/lib/product-query";
import type { CategoryOption, ProductListQuery, ProductListResult, ProductTypeOption } from "@/lib/types";

export function ProductFilters({
  query,
  counts,
  categories,
  productTypes,
}: {
  query: ProductListQuery;
  counts: ProductListResult["counts"];
  categories: CategoryOption[];
  productTypes: ProductTypeOption[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();

  const tabs = [
    { status: null, label: "All", count: counts.all },
    { status: "low" as const, label: "Low stock", count: counts.low },
    { status: "in-stock" as const, label: "In stock", count: counts.inStock },
  ];

  return (
    <div className="space-y-4 border-b border-line p-4">
      <Form
        ref={formRef}
        action="/products"
        role="search"
        // Re-mount on navigation so inputs show the current URL's values.
        key={productListHref(query)}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="mb-1.5 block text-sm font-medium">
            Search
          </label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <Input
              id="q"
              name="q"
              type="search"
              defaultValue={query.q}
              maxLength={SEARCH_MAX}
              placeholder="Name, SKU, size, colour…"
              className="pl-9"
            />
          </div>
        </div>
        <div className="w-44">
          <label htmlFor="category" className="mb-1.5 block text-sm font-medium">
            Category
          </label>
          <Select id="category" name="category" defaultValue={query.category ?? ""} onChange={submit}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-44">
          <label htmlFor="type" className="mb-1.5 block text-sm font-medium">
            Product type
          </label>
          <Select id="type" name="type" defaultValue={query.type ?? ""} onChange={submit}>
            <option value="">All types</option>
            {productTypes.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        {query.status && <input type="hidden" name="status" value={query.status} />}
        {query.sort !== "name" && <input type="hidden" name="sort" value={query.sort} />}
        {query.dir !== defaultDirection(query.sort) && <input type="hidden" name="dir" value={query.dir} />}
        <button type="submit" className={buttonClass("secondary")}>
          Search
        </button>
        {hasActiveFilters(query) && (
          <Link href="/products" className={buttonClass("ghost")}>
            <X aria-hidden />
            Clear
          </Link>
        )}
      </Form>

      <nav aria-label="Stock status" className="flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const active = query.status === tab.status;
          return (
            <Link
              key={tab.label}
              href={productListHref(query, { status: tab.status })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-control px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-sunken hover:text-ink",
                active && "bg-ink text-white hover:bg-ink hover:text-white",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "tabular rounded-badge px-1.5 text-xs",
                  active ? "bg-white/20" : tab.status === "low" && tab.count > 0 ? "bg-clay-soft text-clay-ink" : "bg-sunken",
                )}
              >
                {formatCount(tab.count)}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
