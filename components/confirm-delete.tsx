"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button, buttonClass } from "@/components/ui/button";
import type { ActionResult } from "@/lib/types";

/**
 * Delete button with a confirmation dialog. The action redirects on success; on failure the
 * dialog stays open and shows the reason (e.g. "still has 3 products").
 */
export function ConfirmDelete({
  action,
  title,
  description,
  confirmLabel = "Delete",
  triggerLabel = "Delete",
  size = "md",
}: {
  action: () => Promise<ActionResult>;
  title: string;
  description: string;
  confirmLabel?: string;
  triggerLabel?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <AlertDialog.Trigger className={buttonClass("secondary", size, "text-danger")}>
        <Trash2 aria-hidden />
        {triggerLabel}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-ink/40" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-panel bg-surface p-6 shadow-xl">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-ink-muted">{description}</AlertDialog.Description>
          {error && (
            <p role="alert" className="mt-4 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Close className={buttonClass("secondary")}>Cancel</AlertDialog.Close>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await action();
                  if (result && !result.ok) setError(result.message);
                })
              }
            >
              {pending ? "Deleting…" : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
