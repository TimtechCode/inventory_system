import "server-only";

import { io } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ADJUSTMENT_HELP } from "@/lib/stock-movements";
import { MAX_STOCK_QUANTITY } from "@/lib/stock";
import { ADJUSTMENT_KINDS, STOCK_MOVEMENT_KINDS } from "@/lib/types";
import type {
  FieldErrors,
  ServiceResult,
  StockAdjustmentInput,
  StockHistoryQuery,
  StockHistoryResult,
  StockMovementKind,
  StockMovementRow,
} from "@/lib/types";

import { NOT_FOUND, cleanText, fail, ok, parseStockInt } from "./shared";

export const STOCK_HISTORY_PAGE_SIZE = 50;
export const NOTE_MAX = 200;

type Tx = Prisma.TransactionClient;

export type MovementDraft = {
  productId: string;
  variantId: string;
  productName: string;
  sku: string;
  variantLabel: string;
  kind: StockMovementKind;
  quantityChange: number;
  quantityAfter: number;
  note?: string | null;
};

/** Writes movements inside the caller's transaction (used by product create/update too). */
export async function recordMovements(tx: Tx, drafts: MovementDraft[]): Promise<void> {
  if (drafts.length === 0) return;
  await tx.stockMovement.createMany({
    data: drafts.map((d) => ({ ...d, note: d.note ?? null })),
  });
}

/** "M / Indigo" for a variant, in attribute order; "" for a default SKU. */
async function variantLabel(tx: Tx, variantId: string): Promise<string> {
  const values = await tx.variantOptionValue.findMany({
    where: { variantId },
    include: { attribute: { select: { position: true } }, option: { select: { value: true } } },
  });
  return values
    .sort((a, b) => a.attribute.position - b.attribute.position)
    .map((v) => v.option.value)
    .join(" / ");
}

// ---------------------------------------------------------------------------
// Adjust stock
// ---------------------------------------------------------------------------

export type AdjustmentResult = { quantityAfter: number; quantityChange: number; sku: string };

export async function adjustStock(input: StockAdjustmentInput): Promise<ServiceResult<AdjustmentResult>> {
  const errors: FieldErrors = {};
  if (!(ADJUSTMENT_KINDS as readonly string[]).includes(input.kind)) errors.kind = "Choose what happened";

  const help = ADJUSTMENT_HELP[input.kind] ?? ADJUSTMENT_HELP.RECEIVED;
  const qty = parseStockInt(input.quantity, help.label.toLowerCase());
  if (!qty.ok) errors.quantity = qty.message;
  else if (help.direction !== 0 && qty.value === 0) errors.quantity = "Enter a quantity of 1 or more";

  const note = cleanText(input.note);
  if (note.length > NOTE_MAX) errors.note = `Use ${NOTE_MAX} characters or fewer`;
  if (Object.keys(errors).length > 0 || !qty.ok) return fail("Fix the highlighted fields and try again.", errors);

  // SQLite serialises write transactions, so reading then writing here can't interleave with
  // another adjustment of the same SKU.
  return db.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({
      where: { id: input.variantId },
      select: { id: true, sku: true, quantityOnHand: true, product: { select: { id: true, name: true } } },
    });
    if (!variant) return fail(NOT_FOUND);

    const before = variant.quantityOnHand;
    const after = help.direction === 0 ? qty.value : before + help.direction * qty.value;
    if (after < 0) {
      return fail("Fix the highlighted fields and try again.", {
        quantity: `Only ${before} on hand. Record a stock count if the quantity is wrong.`,
      });
    }
    if (after > MAX_STOCK_QUANTITY) {
      return fail("Fix the highlighted fields and try again.", {
        quantity: `Stock can't go above ${MAX_STOCK_QUANTITY.toLocaleString("en-US")}`,
      });
    }

    await tx.productVariant.update({ where: { id: variant.id }, data: { quantityOnHand: after } });
    // Touch the product so its "updated" date moves and open edit forms detect the change.
    await tx.product.update({ where: { id: variant.product.id }, data: { updatedAt: new Date() } });
    await recordMovements(tx, [
      {
        productId: variant.product.id,
        variantId: variant.id,
        productName: variant.product.name,
        sku: variant.sku,
        variantLabel: await variantLabel(tx, variant.id),
        kind: input.kind,
        quantityChange: after - before,
        quantityAfter: after,
        note: note || null,
      },
    ]);
    return ok({ quantityAfter: after, quantityChange: after - before, sku: variant.sku });
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

type MovementRecord = {
  id: number;
  kind: StockMovementKind;
  quantityChange: number;
  quantityAfter: number;
  note: string | null;
  createdAt: Date;
  productId: string | null;
  productName: string;
  sku: string;
  variantLabel: string;
  product: { name: string } | null;
};

function toRow(m: MovementRecord): StockMovementRow {
  return {
    id: m.id,
    kind: m.kind,
    quantityChange: m.quantityChange,
    quantityAfter: m.quantityAfter,
    note: m.note,
    createdAt: m.createdAt.toISOString(),
    productId: m.productId,
    productName: m.product?.name ?? m.productName,
    sku: m.sku,
    variantLabel: m.variantLabel,
  };
}

const movementInclude = { product: { select: { name: true } } } as const;

/** Most recent movements for one product, newest first. */
export async function getRecentMovements(productId: string, take = 8): Promise<{ items: StockMovementRow[]; total: number }> {
  await io();
  const [rows, total] = await Promise.all([
    db.stockMovement.findMany({
      where: { productId },
      orderBy: { id: "desc" },
      take,
      include: movementInclude,
    }),
    db.stockMovement.count({ where: { productId } }),
  ]);
  return { items: rows.map(toRow), total };
}

type RawParams = Record<string, string | string[] | undefined>;

function first(params: RawParams, key: string): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

export function parseStockHistoryQuery(params: RawParams): StockHistoryQuery {
  const product = first(params, "product");
  const kind = first(params, "kind");
  const page = Number.parseInt(first(params, "page") ?? "1", 10);
  return {
    product: product && /^[a-z0-9]{1,64}$/i.test(product) ? product : null,
    kind: (STOCK_MOVEMENT_KINDS as readonly string[]).includes(kind ?? "") ? (kind as StockMovementKind) : null,
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, 100_000) : 1,
  };
}

export async function listStockMovements(query: StockHistoryQuery): Promise<StockHistoryResult> {
  await io();
  const where = {
    ...(query.product ? { productId: query.product } : {}),
    ...(query.kind ? { kind: query.kind } : {}),
  };
  const [total, product] = await Promise.all([
    db.stockMovement.count({ where }),
    query.product ? db.product.findUnique({ where: { id: query.product }, select: { name: true } }) : null,
  ]);
  const pageCount = Math.max(1, Math.ceil(total / STOCK_HISTORY_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const rows = await db.stockMovement.findMany({
    where,
    orderBy: { id: "desc" },
    skip: (page - 1) * STOCK_HISTORY_PAGE_SIZE,
    take: STOCK_HISTORY_PAGE_SIZE,
    include: movementInclude,
  });
  return {
    items: rows.map(toRow),
    query: { ...query, page },
    productName: product?.name ?? (rows[0] && query.product ? rows[0].productName : null),
    total,
    page,
    pageSize: STOCK_HISTORY_PAGE_SIZE,
    pageCount,
  };
}

/** "/stock?…" omitting defaults. Changing a filter resets to page 1. */
export function stockHistoryHref(query: StockHistoryQuery, changes: Partial<StockHistoryQuery> = {}): string {
  const resetsPage = Object.keys(changes).some((k) => k !== "page");
  const next = { ...query, ...(resetsPage ? { page: 1 } : {}), ...changes };
  const params = new URLSearchParams();
  if (next.product) params.set("product", next.product);
  if (next.kind) params.set("kind", next.kind);
  if (next.page > 1) params.set("page", String(next.page));
  const s = params.toString();
  return s ? `/stock?${s}` : "/stock";
}
