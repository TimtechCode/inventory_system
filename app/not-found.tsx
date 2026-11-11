import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-sm font-medium text-ink-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-ink-muted">This page doesn&apos;t exist, or the record was deleted.</p>
      <LinkButton href="/products" className="mt-6">
        Go to products
      </LinkButton>
    </div>
  );
}
