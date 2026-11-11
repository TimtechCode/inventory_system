import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 space-y-3">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ChevronLeft aria-hidden className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <div className="text-sm text-ink-muted">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-panel border border-line bg-surface ${className}`}>{children}</section>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-muted">{children}</div>}
    </div>
  );
}

export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-3 p-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-control bg-sunken" />
      ))}
    </div>
  );
}
