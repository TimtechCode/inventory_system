import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, Skeleton } from "@/components/ui/page-header";
import { formatDate, plural } from "@/lib/format";
import { listProductTypes } from "@/lib/services/product-types";

export const metadata: Metadata = { title: "Product types" };

export default function ProductTypesPage() {
  return (
    <>
      <PageHeader
        title="Product types"
        description="Templates that decide which details a product records and which attributes create SKUs."
        actions={
          <LinkButton href="/types/new">
            <Plus aria-hidden />
            Add product type
          </LinkButton>
        }
      />
      <Panel>
        <Suspense fallback={<Skeleton rows={5} />}>
          <TypeTable />
        </Suspense>
      </Panel>
    </>
  );
}

async function TypeTable() {
  const types = await listProductTypes();
  if (types.length === 0) {
    return (
      <EmptyState title="No product types yet">
        <Link href="/types/new" className="font-medium text-sage underline">
          Add your first product type
        </Link>
      </EmptyState>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <thead className="border-b border-line text-left text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Attributes</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Products</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {types.map((t) => (
            <tr key={t.id} className="align-top">
              <td className="px-4 py-3">
                <Link href={`/types/${t.id}/edit`} className="font-medium hover:text-sage hover:underline">
                  {t.name}
                </Link>
                {t.description && <p className="mt-0.5 text-ink-muted">{t.description}</p>}
              </td>
              <td className="px-4 py-3">
                {t.attributeNames.length === 0 ? (
                  <span className="text-ink-muted">None</span>
                ) : (
                  <ul className="flex flex-wrap gap-1">
                    {t.attributeNames.map((name) => {
                      const variant = t.variantAttributeNames.includes(name);
                      return (
                        <li
                          key={name}
                          className={variant ? "rounded-badge bg-sage-soft px-2 py-0.5 text-xs text-sage-strong" : "rounded-badge bg-sunken px-2 py-0.5 text-xs"}
                        >
                          {name}
                          {variant && <span className="sr-only"> (creates variants)</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </td>
              <td className="px-4 py-3">
                {t.productCount > 0 ? (
                  <Link href={`/products?type=${t.slug}`} className="text-sage hover:underline">
                    {plural(t.productCount, "product")}
                  </Link>
                ) : (
                  <span className="text-ink-muted">None</span>
                )}
              </td>
              <td className="px-4 py-3 text-ink-muted">{formatDate(t.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-4 py-2.5 text-xs text-ink-muted">
        <span className="mr-1 inline-block size-2 rounded-full bg-sage-soft ring-1 ring-sage/40 align-middle" /> Green attributes create variants.
      </p>
    </div>
  );
}
