import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { deleteCategoryAction, updateCategoryAction } from "@/app/actions/categories";
import { ConfirmDelete } from "@/components/confirm-delete";
import { PageHeader, Skeleton } from "@/components/ui/page-header";
import { plural } from "@/lib/format";
import { getCategory } from "@/lib/services/categories";

import { CategoryForm } from "../../category-form";

export const metadata: Metadata = { title: "Edit category" };

export default function EditCategoryPage({ params }: PageProps<"/categories/[id]/edit">) {
  return (
    <div className="mx-auto max-w-2xl">
      <Suspense fallback={<Skeleton rows={4} />}>
        <EditCategory params={params} />
      </Suspense>
    </div>
  );
}

async function EditCategory({ params }: Pick<PageProps<"/categories/[id]/edit">, "params">) {
  const { id } = await params;
  const category = await getCategory(id);
  if (!category) notFound();
  return (
    <>
      <PageHeader
        back={{ href: "/categories", label: "All categories" }}
        title={`Edit ${category.name}`}
        description={plural(category.productCount, "product")}
        actions={
          <ConfirmDelete
            action={deleteCategoryAction.bind(null, id)}
            title={`Delete “${category.name}”?`}
            description={
              category.productCount > 0
                ? `This category has ${plural(category.productCount, "product")}. Move them to another category before deleting it.`
                : "This can't be undone."
            }
            confirmLabel="Delete category"
          />
        }
      />
      <CategoryForm key={category.updatedAt} action={updateCategoryAction.bind(null, id)} category={category} />
    </>
  );
}
