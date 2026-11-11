import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { STOCK_STATUS_LABELS, stockMeter } from "@/lib/stock";
import type { StockStatus } from "@/lib/types";

export function StockBadge({ status, className }: { status: StockStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-badge px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        status === "low" ? "bg-clay-soft text-clay-ink" : "bg-sage-soft text-sage-strong",
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", status === "low" ? "bg-clay" : "bg-sage")} />
      {STOCK_STATUS_LABELS[status]}
    </span>
  );
}

/** Quantity with a small bar whose tick marks the reorder level. */
export function StockMeter({
  quantity,
  reorderLevel,
  status,
}: {
  quantity: number;
  reorderLevel: number;
  /** Overrides the colour, e.g. a product total that is fine overall but has a low SKU. */
  status?: StockStatus;
}) {
  const geometry = stockMeter(quantity, reorderLevel);
  const m = status ? { ...geometry, tone: status === "low" ? ("low" as const) : ("ok" as const) } : geometry;
  return (
    <div className="flex items-center gap-2">
      <span className={cn("tabular w-10 text-right font-medium", m.tone === "low" && "text-clay-ink")}>
        {formatCount(quantity)}
      </span>
      <span aria-hidden className="relative h-1.5 w-16 overflow-hidden rounded-badge bg-sunken">
        <span
          className={cn("absolute inset-y-0 left-0 rounded-badge", m.tone === "low" ? "bg-clay" : "bg-sage")}
          style={{ width: `${Math.round(m.fill * 100)}%` }}
        />
        {m.tick !== null && (
          <span className="absolute inset-y-0 w-px bg-ink/50" style={{ left: `${Math.round(m.tick * 100)}%` }} />
        )}
      </span>
    </div>
  );
}
