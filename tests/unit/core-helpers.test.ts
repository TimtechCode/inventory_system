import { describe, expect, it } from "vitest";

import { cn } from "@/lib/cn";
import { formatCount, formatDate, formatDateTime, plural } from "@/lib/format";
import {
  MAX_PRICE_KOBO,
  effectivePriceKobo,
  formatNaira,
  formatNairaRange,
  koboToNairaInput,
  parseNairaToKobo,
} from "@/lib/money";
import { stockMeter, stockStatus, summarizeStock } from "@/lib/stock";

describe("money", () => {
  it.each([
    ["18500", 1_850_000],
    ["18,500", 1_850_000],
    ["₦18,500.50", 1_850_050],
    ["NGN 2,000", 200_000],
    [" 0.5 ", 50],
    ["007", 700],
    ["99,999,999.99", MAX_PRICE_KOBO],
  ])("parses %s", (raw, kobo) => {
    expect(parseNairaToKobo(raw)).toEqual({ ok: true, kobo });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["18.505", "format"],
    ["-1", "format"],
    ["1e5", "format"],
    ["abc", "format"],
    ["0", "zero"],
    ["0.00", "zero"],
    ["100,000,000", "too_large"],
  ])("rejects %s as %s", (raw, reason) => {
    expect(parseNairaToKobo(raw)).toEqual({ ok: false, reason });
  });

  it("formats naira with and without kobo", () => {
    expect(formatNaira(1_850_000)).toBe("₦18,500");
    expect(formatNaira(1_850_050)).toBe("₦18,500.50");
    expect(formatNaira(5)).toBe("₦0.05");
    expect(formatNaira(11_800_000)).toBe("₦118,000");
    expect(koboToNairaInput(1_850_050)).toBe("18,500.50");
  });

  it("formats ranges and effective prices", () => {
    expect(formatNairaRange({ minKobo: 850_000, maxKobo: 850_000 })).toBe("₦8,500");
    expect(formatNairaRange({ minKobo: 850_000, maxKobo: 950_000 })).toBe("₦8,500 – ₦9,500");
    expect(effectivePriceKobo(100, null)).toBe(100);
    expect(effectivePriceKobo(100, 250)).toBe(250);
  });
});

describe("stock", () => {
  it("applies quantity <= reorder level as LOW STOCK", () => {
    expect(stockStatus(0, 0)).toBe("low");
    expect(stockStatus(3, 3)).toBe("low");
    expect(stockStatus(2, 3)).toBe("low");
    expect(stockStatus(4, 3)).toBe("in-stock");
    expect(stockStatus(1, 0)).toBe("in-stock");
  });

  it("summarises SKUs", () => {
    expect(
      summarizeStock([
        { quantityOnHand: 2, reorderLevel: 3 },
        { quantityOnHand: 9, reorderLevel: 3 },
      ]),
    ).toEqual({ totalQuantity: 11, variantCount: 2, lowStockCount: 1, status: "low" });
    expect(summarizeStock([{ quantityOnHand: 9, reorderLevel: 3 }]).status).toBe("in-stock");
  });

  it("models the meter", () => {
    expect(stockMeter(3, 3)).toEqual({ fill: 1 / 3, tick: 1 / 3, tone: "low" });
    expect(stockMeter(20, 3)).toEqual({ fill: 1, tick: 1 / 3, tone: "ok" });
    expect(stockMeter(0, 0)).toEqual({ fill: 0, tick: null, tone: "low" });
    expect(stockMeter(5, 0)).toEqual({ fill: 1, tick: null, tone: "ok" });
  });
});

describe("format", () => {
  it("formats dates in West Africa Time", () => {
    expect(formatDate("2026-11-10T23:30:00.000Z")).toBe("11 Nov 2026");
    expect(formatDateTime("2026-11-10T13:05:00.000Z")).toBe("10 Nov 2026, 14:05");
  });

  it("formats counts and plurals", () => {
    expect(formatCount(1234567)).toBe("1,234,567");
    expect(plural(1, "product")).toBe("1 product");
    expect(plural(41, "SKU")).toBe("41 SKUs");
    expect(plural(2, "category", "categories")).toBe("2 categories");
  });
});

describe("cn", () => {
  it("merges conflicting utilities including custom radius tokens", () => {
    expect(cn("px-2", false && "hidden", "px-4")).toBe("px-4");
    expect(cn("rounded-control", "rounded-panel")).toBe("rounded-panel");
    expect(cn("text-sm text-ink", "text-sage")).toBe("text-sm text-sage");
  });
});
