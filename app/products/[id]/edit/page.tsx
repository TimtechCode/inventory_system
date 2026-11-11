import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { updateProductAction } from "@/app/actions/products";
import { PageHeader, Skeleton } from "@/components/ui/page-header";
import { getProductEditData } from "@/lib/services/products";

import { ProductForm } from "../../product-form";

export const metadata: Metadata = { title: "Edit product" };

export default function EditProductPage({ params }: PageProps<"/products/[id]/edit">) {
  return (
    <div className="mx-auto max-w-4xl">
      <Suspense fallback={<Skeleton rows={8} />}>
        <EditProduct params={params} />
      </Suspense>
    </div>
  );
}

async function EditProduct({ params }: Pick<PageProps<"/products/[id]/edit">, "params">) {
  const { id } = await params;
  const data = await getProductEditData(id);
  if (!data) notFound();
  return (
    <>
      <PageHeader back={{ href: `/products/${id}`, label: data.product.name }} title={`Edit ${data.product.name}`} />
      <ProductForm
        // A fresh form whenever the stored product changes (e.g. after saving).
        key={data.product.updatedAt}
        action={updateProductAction.bind(null, id)}
        categories={data.categories}
        productTypes={[data.productType]}
        product={data.product}
        cancelHref={`/products/${id}`}
      />
    </>
  );
}
