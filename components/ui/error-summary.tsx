"use client";

import { AlertCircle } from "lucide-react";
import { useEffect, useRef } from "react";

import type { FormState } from "@/lib/types";

/** Summary shown at the top of a form after a failed submit; takes focus on every new attempt. */
export function ErrorSummary({ state }: { state: FormState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === "error") ref.current?.focus();
  }, [state.attempt, state.status]);

  if (state.status !== "error") return null;
  const count = Object.keys(state.fieldErrors).length;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="flex gap-3 rounded-panel border border-danger/40 bg-danger-soft p-4 text-sm text-ink focus:outline-none"
    >
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
      <div>
        <p className="font-medium">{state.formError ?? "Something went wrong."}</p>
        {count > 0 && <p className="mt-1 text-ink-muted">{count === 1 ? "1 field needs attention." : `${count} fields need attention.`}</p>}
      </div>
    </div>
  );
}
