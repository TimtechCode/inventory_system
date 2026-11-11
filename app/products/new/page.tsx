import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { createProductAction } from "@/app/actions/products";
import { PageHeader, Panel, Skeleton } from "@/components/ui/page-header";
import { getProductFormOptions } from "@/lib/services/products";

import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Add product" };

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={{ href: "/products", label: "All products" }} title="Add product" />
      <Suspense fallback={<Skeleton rows={8} />}>
        <NewProductForm />
      </Suspense>
    </div>
  );
}

async function NewProductForm() {
  const { categories, productTypes } = await getProductFormOptions();
  if (categories.length === 0 || productTypes.length === 0) {
    return (
      <Panel className="p-6 text-sm">
        <p className="font-medium">Set up your catalogue first</p>
        <p className="mt-1 text-ink-muted">
          Every product needs a{" "}
          {categories.length === 0 && (
            <Link href="/categories/new" className="font-medium text-sage underline">
              category
            </Link>
          )}
          {categories.length === 0 && productTypes.length === 0 && " and a "}
          {productTypes.length === 0 && (
            <Link href="/types/new" className="font-medium text-sage underline">
              product type
            </Link>
          )}
          .
        </p>
      </Panel>
    );
  }
  return <ProductForm action={createProductAction} categories={categories} productTypes={productTypes} cancelHref="/products" />;
}
