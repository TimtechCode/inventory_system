import type { StockStatus, StockSummary } from "@/lib/types";

/** Upper bound for quantities and reorder levels accepted by forms and services. */
export const MAX_STOCK_QUANTITY = 999_999;

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  low: "Low stock",
  "in-stock": "In stock",
};

/** The single low-stock rule: a SKU is low when its quantity is at or below its reorder level. */
export function stockStatus(quantityOnHand: number, reorderLevel: number): StockStatus {
  return quantityOnHand <= reorderLevel ? "low" : "in-stock";
}

export function summarizeStock(
  variants: ReadonlyArray<{ quantityOnHand: number; reorderLevel: number }>,
): StockSummary {
  let totalQuantity = 0;
  let lowStockCount = 0;
  for (const variant of variants) {
    totalQuantity += variant.quantityOnHand;
    if (stockStatus(variant.quantityOnHand, variant.reorderLevel) === "low") lowStockCount += 1;
  }
  return {
    totalQuantity,
    variantCount: variants.length,
    lowStockCount,
    status: lowStockCount > 0 ? "low" : "in-stock",
  };
}

export type StockMeterModel = {
  /** Filled share of the bar, 0..1. */
  fill: number;
  /** Position of the reorder-level tick, 0..1, or null when the reorder level is 0. */
  tick: number | null;
  tone: "low" | "ok";
};

/**
 * Geometry for the inline stock meter. The bar's full width represents three times the reorder
 * level, so the reorder tick always sits at one third and "healthy" stock fills the rest.
 */
export function stockMeter(quantityOnHand: number, reorderLevel: number): StockMeterModel {
  const tone = stockStatus(quantityOnHand, reorderLevel) === "low" ? "low" : "ok";
  if (reorderLevel <= 0) {
    return { fill: quantityOnHand > 0 ? 1 : 0, tick: null, tone };
  }
  const capacity = reorderLevel * 3;
  return { fill: Math.min(Math.max(quantityOnHand, 0) / capacity, 1), tick: 1 / 3, tone };
}
