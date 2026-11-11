import { Pencil } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { deleteProductAction } from "@/app/actions/products";
import { ConfirmDelete } from "@/components/confirm-delete";
import { StockBadge, StockMeter } from "@/components/stock";
import { LinkButton } from "@/components/ui/button";
import { PageHeader, Panel, Skeleton } from "@/components/ui/page-header";
import { formatCount, formatDateTime, plural } from "@/lib/format";
import { formatNaira, formatNairaRange } from "@/lib/money";
import { getProductDetail } from "@/lib/services/products";

export const metadata: Metadata = { title: "Product" };

export default function ProductPage({ params }: PageProps<"/products/[id]">) {
  return (
    <Suspense fallback={<Skeleton rows={6} />}>
      <ProductDetailView params={params} />
    </Suspense>
  );
}

async function ProductDetailView({ params }: Pick<PageProps<"/products/[id]">, "params">) {
  const { id } = await params;
  const p = await getProductDetail(id);
  if (!p) notFound();

  return (
    <>
      <title>{`${p.name} · People's Shop Inventory`}</title>
      <PageHeader
        back={{ href: "/products", label: "All products" }}
        title={p.name}
        description={
          <span>
            {p.category.name} · {p.productType.name} · Updated {formatDateTime(p.updatedAt)}
          </span>
        }
        actions={
          <>
            <LinkButton href={`/products/${p.id}/edit`} variant="secondary">
              <Pencil aria-hidden />
              Edit
            </LinkButton>
            <ConfirmDelete
              action={deleteProductAction.bind(null, p.id)}
              title={`Delete “${p.name}”?`}
              description={`This removes the product and its ${plural(p.variantCount, "SKU")} (${formatCount(p.totalQuantity)} units on hand). This can't be undone.`}
              confirmLabel="Delete product"
            />
          </>
        }
      />

      <dl className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Price" value={formatNairaRange(p.price)} />
        <Stat label="On hand" value={plural(p.totalQuantity, "unit")} />
        <Stat label="SKUs" value={formatCount(p.variantCount)} />
        <Stat
          label="Stock status"
          value={
            <span className="flex items-center gap-2">
              <StockBadge status={p.status} />
              {p.lowStockCount > 0 && p.hasVariants && (
                <span className="text-sm text-clay-ink">{formatCount(p.lowStockCount)} low</span>
              )}
            </span>
          }
        />
      </dl>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <h2 className="border-b border-line px-4 py-3 font-semibold">{p.hasVariants ? "Variants" : "Stock"}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="border-b border-line text-left text-ink-muted">
                <tr>
                  {p.axes.map((a) => (
                    <th key={a.attributeId} scope="col" className="px-4 py-2.5 font-medium">
                      {a.name}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-2.5 font-medium">SKU</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Price</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">On hand</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Reorder at</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {p.variants.map((v) => (
                  <tr key={v.id}>
                    {v.options.map((o) => (
                      <td key={o.attributeId} className="px-4 py-2.5">
                        {o.value}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 font-mono text-xs">{v.sku}</td>
                    <td className="tabular px-4 py-2.5 text-right">
                      {formatNaira(v.priceKobo)}
                      {v.priceOverrideKobo !== null && <span className="sr-only"> (variant price)</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <StockMeter quantity={v.quantityOnHand} reorderLevel={v.reorderLevel} />
                    </td>
                    <td className="tabular px-4 py-2.5 text-right">{formatCount(v.reorderLevel)}</td>
                    <td className="px-4 py-2.5">
                      <StockBadge status={v.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <h2 className="border-b border-line px-4 py-3 font-semibold">Details</h2>
          <div className="space-y-4 p-4 text-sm">
            {p.description ? (
              <p className="whitespace-pre-line">{p.description}</p>
            ) : (
              <p className="text-ink-muted">No description.</p>
            )}
            <dl className="divide-y divide-line">
              <Row label="Base price" value={formatNaira(p.priceKobo)} />
              {p.attributes.map((a) => (
                <Row key={a.attributeId} label={a.name} value={a.display} />
              ))}
              <Row label="Created" value={formatDateTime(p.createdAt)} />
            </dl>
          </div>
        </Panel>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-panel border border-line bg-surface px-4 py-3">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="tabular mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
