import type { Metadata } from "next";

import { createCategoryAction } from "@/app/actions/categories";
import { PageHeader } from "@/components/ui/page-header";

import { CategoryForm } from "../category-form";

export const metadata: Metadata = { title: "Add category" };

export default function NewCategoryPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: "/categories", label: "All categories" }} title="Add category" />
      <CategoryForm action={createCategoryAction} />
    </div>
  );
}
