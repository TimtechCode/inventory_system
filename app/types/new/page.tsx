import type { Metadata } from "next";

import { createProductTypeAction } from "@/app/actions/product-types";
import { PageHeader } from "@/components/ui/page-header";

import { ProductTypeForm } from "../product-type-form";

export const metadata: Metadata = { title: "Add product type" };

export default function NewProductTypePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={{ href: "/types", label: "All product types" }} title="Add product type" />
      <ProductTypeForm action={createProductTypeAction} />
    </div>
  );
}
