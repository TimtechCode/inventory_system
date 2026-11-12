import { X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { MovementTable } from "@/components/movement-table";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, Skeleton } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { formatCount, plural } from "@/lib/format";
import { listStockMovements, parseStockHistoryQuery, stockHistoryHref } from "@/lib/services/stock";
import { MOVEMENT_LABELS } from "@/lib/stock-movements";
import { STOCK_MOVEMENT_KINDS } from "@/lib/types";
import type { StockHistoryQuery } from "@/lib/types";

export const metadata: Metadata = { title: "Stock history" };

export default function StockHistoryPage({ searchParams }: PageProps<"/stock">) {
  return (
    <>
      <PageHeader
        title="Stock history"
        description="Every change to quantities on hand, newest first. Record deliveries, sales and counts from a product's page."
      />
      <Panel>
        <Suspense fallback={<Skeleton rows={10} />}>
          <History searchParams={searchParams} />
        </Suspense>
      </Panel>
    </>
  );
}

async function History({ searchParams }: Pick<PageProps<"/stock">, "searchParams">) {
  const result = await listStockMovements(parseStockHistoryQuery(await searchParams));
  const q = result.query;
  const first = (result.page - 1) * result.pageSize + 1;
  const last = first + result.items.length - 1;

  return (
    <>
      <div className="space-y-3 border-b border-line p-4">
        {q.product && (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            Showing history for{" "}
            {result.productName ? (
              <Link href={`/products/${q.product}`} className="font-medium text-sage hover:underline">
                {result.productName}
              </Link>
            ) : (
              <span className="font-medium">a deleted product</span>
            )}
            <Link href={stockHistoryHref(q, { product: null })} className={buttonClass("ghost", "sm")}>
              <X aria-hidden />
              Show all products
            </Link>
          </p>
        )}
        <nav aria-label="Movement type" className="flex flex-wrap gap-1">
          <KindLink query={q} kind={null} label="All types" />
          {STOCK_MOVEMENT_KINDS.map((k) => (
            <KindLink key={k} query={q} kind={k} label={MOVEMENT_LABELS[k]} />
          ))}
        </nav>
      </div>

      {result.items.length === 0 ? (
        <EmptyState title={q.kind || q.product ? "No movements match these filters" : "No stock movements yet"}>
          {(q.kind || q.product) && (
            <Link href="/stock" className="font-medium text-sage underline">
              Clear filters
            </Link>
          )}
        </EmptyState>
      ) : (
        <>
          <MovementTable items={result.items} showProduct={!q.product} caption="Stock movements, newest first" />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-ink-muted">
            <p>
              Showing <span className="tabular">{formatCount(first)}</span>–<span className="tabular">{formatCount(last)}</span> of{" "}
              {plural(result.total, "movement")}
            </p>
            {result.pageCount > 1 && (
              <nav aria-label="Pagination" className="flex items-center gap-2">
                <PageLink query={q} page={result.page - 1} disabled={result.page <= 1} label="Newer" />
                <span className="tabular">
                  Page {result.page} of {result.pageCount}
                </span>
                <PageLink query={q} page={result.page + 1} disabled={result.page >= result.pageCount} label="Older" />
              </nav>
            )}
          </div>
        </>
      )}
    </>
  );
}

function KindLink({ query, kind, label }: { query: StockHistoryQuery; kind: StockHistoryQuery["kind"]; label: string }) {
  const active = query.kind === kind;
  return (
    <Link
      href={stockHistoryHref(query, { kind })}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-control px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-sunken hover:text-ink",
        active && "bg-ink text-white hover:bg-ink hover:text-white",
      )}
    >
      {label}
    </Link>
  );
}

function PageLink({ query, page, disabled, label }: { query: StockHistoryQuery; page: number; disabled: boolean; label: string }) {
  if (disabled) {
    return (
      <span aria-disabled="true" className={buttonClass("secondary", "sm", "pointer-events-none opacity-50")}>
        {label}
      </span>
    );
  }
  return (
    <Link href={stockHistoryHref(query, { page })} className={buttonClass("secondary", "sm")}>
      {label}
    </Link>
  );
}
