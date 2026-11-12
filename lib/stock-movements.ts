// Labels and helpers for stock movements. Client-safe.

import type { AdjustmentKind, StockMovementKind } from "@/lib/types";

export const MOVEMENT_LABELS: Record<StockMovementKind, string> = {
  INITIAL: "Opening stock",
  RECEIVED: "Received",
  SOLD: "Sold",
  RETURNED: "Customer return",
  DAMAGED: "Damaged or lost",
  COUNT: "Stock count",
  EDIT: "Edited",
};

/** What the quantity field means for each adjustment, shown in the dialog. */
export const ADJUSTMENT_HELP: Record<AdjustmentKind, { label: string; hint: string; direction: 1 | -1 | 0 }> = {
  RECEIVED: { label: "Quantity received", hint: "Adds to stock.", direction: 1 },
  SOLD: { label: "Quantity sold", hint: "Takes away from stock.", direction: -1 },
  RETURNED: { label: "Quantity returned", hint: "Adds back to stock.", direction: 1 },
  DAMAGED: { label: "Quantity damaged or lost", hint: "Takes away from stock.", direction: -1 },
  COUNT: { label: "Counted quantity", hint: "Sets stock to what you counted.", direction: 0 },
};

/** "+12", "−3" (true minus sign), "0". */
export function formatChange(change: number): string {
  const digits = String(Math.abs(change)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (change > 0) return `+${digits}`;
  if (change < 0) return `−${digits}`;
  return "0";
}

/** Quantity on hand after applying an adjustment of `quantity` units. */
export function previewAdjustment(kind: AdjustmentKind, current: number, quantity: number): number {
  const { direction } = ADJUSTMENT_HELP[kind];
  return direction === 0 ? quantity : current + direction * quantity;
}
