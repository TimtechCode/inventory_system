import Link from "next/link";

import { cn } from "@/lib/cn";
import { formatCount, formatDateTime } from "@/lib/format";
import { MOVEMENT_LABELS, formatChange } from "@/lib/stock-movements";
import type { StockMovementKind, StockMovementRow } from "@/lib/types";

const KIND_TONE: Record<StockMovementKind, string> = {
  INITIAL: "bg-sunken text-ink",
  RECEIVED: "bg-sage-soft text-sage-strong",
  RETURNED: "bg-sage-soft text-sage-strong",
  SOLD: "bg-[#e8eef8] text-[#28456f]",
  DAMAGED: "bg-clay-soft text-clay-ink",
  COUNT: "bg-[#f1ebf8] text-[#563f78]",
  EDIT: "bg-sunken text-ink",
};

export function MovementKindBadge({ kind }: { kind: StockMovementKind }) {
  return (
    <span className={cn("inline-block rounded-badge px-2 py-0.5 text-xs font-medium whitespace-nowrap", KIND_TONE[kind])}>
      {MOVEMENT_LABELS[kind]}
    </span>
  );
}

/** Stock movements, newest first. `showProduct` adds a product column (for the all-products log). */
export function MovementTable({
  items,
  showProduct,
  caption,
}: {
  items: StockMovementRow[];
  showProduct: boolean;
  caption: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line text-left text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">When</th>
            {showProduct && <th scope="col" className="px-4 py-2.5 font-medium">Product</th>}
            <th scope="col" className="px-4 py-2.5 font-medium">SKU</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Change</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">After</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((m) => (
            <tr key={m.id} className="align-top">
              <td className="px-4 py-2.5 whitespace-nowrap text-ink-muted">{formatDateTime(m.createdAt)}</td>
              {showProduct && (
                <td className="px-4 py-2.5">
                  {m.productId ? (
                    <Link href={`/products/${m.productId}`} className="font-medium hover:text-sage hover:underline">
                      {m.productName}
                    </Link>
                  ) : (
                    <span>
                      {m.productName} <span className="text-xs text-ink-muted">(deleted)</span>
                    </span>
                  )}
                </td>
              )}
              <td className="px-4 py-2.5">
                <span className="font-mono text-xs">{m.sku}</span>
                {m.variantLabel && <div className="text-xs text-ink-muted">{m.variantLabel}</div>}
              </td>
              <td className="px-4 py-2.5">
                <MovementKindBadge kind={m.kind} />
              </td>
              <td
                className={cn(
                  "tabular px-4 py-2.5 text-right font-medium",
                  m.quantityChange > 0 && "text-sage-strong",
                  m.quantityChange < 0 && "text-clay-ink",
                )}
              >
                {m.kind === "INITIAL" ? formatCount(m.quantityChange) : formatChange(m.quantityChange)}
              </td>
              <td className="tabular px-4 py-2.5 text-right">{formatCount(m.quantityAfter)}</td>
              <td className="max-w-64 px-4 py-2.5 text-ink-muted">{m.note ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
