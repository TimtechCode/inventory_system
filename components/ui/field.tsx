import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

export const controlClass =
  "block w-full rounded-control border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-muted/70 " +
  "focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/25 disabled:bg-sunken disabled:text-ink-muted " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClass, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlClass, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(controlClass, "h-10 pr-8", className)} {...props} />;
}

export function fieldIds(id: string) {
  return { hint: `${id}-hint`, error: `${id}-error` };
}

/** Accessible label + hint + error wrapper. Pass the control as children with matching ids. */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const ids = fieldIds(id);
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required ? null : <span className="font-normal text-ink-muted"> (optional)</span>}
      </label>
      {hint && (
        <p id={ids.hint} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {children}
      {error && <FieldError id={ids.error}>{error}</FieldError>}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-sm font-medium text-danger">
      {children}
    </p>
  );
}

/** aria props wiring a control to its Field hint/error. */
export function describedBy(id: string, opts: { hint?: boolean; error?: string }) {
  const ids = fieldIds(id);
  const parts = [opts.hint ? ids.hint : null, opts.error ? ids.error : null].filter(Boolean);
  return {
    id,
    "aria-invalid": opts.error ? true : undefined,
    "aria-describedby": parts.length > 0 ? parts.join(" ") : undefined,
  } as const;
}
