import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { deleteProductTypeAction, updateProductTypeAction } from "@/app/actions/product-types";
import { ConfirmDelete } from "@/components/confirm-delete";
import { PageHeader, Skeleton } from "@/components/ui/page-header";
import { plural } from "@/lib/format";
import { getProductTypeEditData } from "@/lib/services/product-types";

import { ProductTypeForm } from "../../product-type-form";

export const metadata: Metadata = { title: "Edit product type" };

export default function EditProductTypePage({ params }: PageProps<"/types/[id]/edit">) {
  return (
    <div className="mx-auto max-w-4xl">
      <Suspense fallback={<Skeleton rows={6} />}>
        <EditProductType params={params} />
      </Suspense>
    </div>
  );
}

async function EditProductType({ params }: Pick<PageProps<"/types/[id]/edit">, "params">) {
  const { id } = await params;
  const data = await getProductTypeEditData(id);
  if (!data) notFound();
  return (
    <>
      <PageHeader
        back={{ href: "/types", label: "All product types" }}
        title={`Edit ${data.name}`}
        description={plural(data.productCount, "product")}
        actions={
          <ConfirmDelete
            action={deleteProductTypeAction.bind(null, id)}
            title={`Delete “${data.name}”?`}
            description={
              data.productCount > 0
                ? `${plural(data.productCount, "product")} use this type. Delete those products before deleting it.`
                : "This removes the type and its attributes. This can't be undone."
            }
            confirmLabel="Delete product type"
          />
        }
      />
      <ProductTypeForm key={data.updatedAt} action={updateProductTypeAction.bind(null, id)} productType={data} />
    </>
  );
}
