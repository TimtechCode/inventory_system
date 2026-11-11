import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, Skeleton } from "@/components/ui/page-header";
import { formatDate, plural } from "@/lib/format";
import { listCategories } from "@/lib/services/categories";

export const metadata: Metadata = { title: "Categories" };

export default function CategoriesPage() {
  return (
    <>
      <PageHeader
        title="Categories"
        description="Group products for browsing and filtering."
        actions={
          <LinkButton href="/categories/new">
            <Plus aria-hidden />
            Add category
          </LinkButton>
        }
      />
      <Panel>
        <Suspense fallback={<Skeleton rows={5} />}>
          <CategoryTable />
        </Suspense>
      </Panel>
    </>
  );
}

async function CategoryTable() {
  const categories = await listCategories();
  if (categories.length === 0) {
    return (
      <EmptyState title="No categories yet">
        <Link href="/categories/new" className="font-medium text-sage underline">
          Add your first category
        </Link>
      </EmptyState>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="border-b border-line text-left text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Products</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {categories.map((c) => (
            <tr key={c.id} className="align-top">
              <td className="px-4 py-3">
                <Link href={`/categories/${c.id}/edit`} className="font-medium hover:text-sage hover:underline">
                  {c.name}
                </Link>
                {c.description && <p className="mt-0.5 text-ink-muted">{c.description}</p>}
              </td>
              <td className="px-4 py-3">
                {c.productCount > 0 ? (
                  <Link href={`/products?category=${c.slug}`} className="text-sage hover:underline">
                    {plural(c.productCount, "product")}
                  </Link>
                ) : (
                  <span className="text-ink-muted">None</span>
                )}
              </td>
              <td className="px-4 py-3 text-ink-muted">{formatDate(c.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
