"use client";

import { Dialog } from "@base-ui/react/dialog";
import { PackagePlus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { adjustStockAction } from "@/app/actions/stock";
import { Button, buttonClass } from "@/components/ui/button";
import { submitWithoutReset } from "@/components/submit-without-reset";
import { ErrorSummary } from "@/components/ui/error-summary";
import { Field, Input, describedBy } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { withNotice } from "@/lib/notices";
import { ADJUSTMENT_HELP, MOVEMENT_LABELS, formatChange, previewAdjustment } from "@/lib/stock-movements";
import { ADJUSTMENT_KINDS } from "@/lib/types";
import type { AdjustmentKind } from "@/lib/types";
import { initialFormState } from "@/lib/validation/form-state";

type Props = {
  variantId: string;
  /** e.g. "Ankara Wrap Dress — M / Indigo (AWD-IND-M)" */
  label: string;
  quantityOnHand: number;
  reorderLevel: number;
};

export function AdjustStock(props: Props) {
  const [open, setOpen] = useState(false);
  // Remount the form each time the dialog opens so it starts empty.
  const [session, setSession] = useState(0);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSession((s) => s + 1);
      }}
    >
      <Dialog.Trigger className={buttonClass("secondary", "sm")}>
        <PackagePlus aria-hidden />
        Adjust<span className="sr-only"> stock for {props.label}</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel bg-surface p-6 shadow-xl">
          <Dialog.Title className="text-lg font-semibold">Adjust stock</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-ink-muted">
            {props.label} · {formatCount(props.quantityOnHand)} on hand
          </Dialog.Description>
          <AdjustForm key={session} {...props} onDone={() => setOpen(false)} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AdjustForm({ variantId, quantityOnHand, reorderLevel, onDone }: Props & { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(adjustStockAction.bind(null, variantId), initialFormState);
  const [kind, setKind] = useState<AdjustmentKind>("RECEIVED");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const e = state.fieldErrors;

  const handled = useRef(0);
  useEffect(() => {
    if (state.status !== "success" || handled.current === state.attempt) return;
    handled.current = state.attempt;
    onDone();
    router.replace(withNotice(pathname, "stock-adjusted"), { scroll: false });
  }, [state, onDone, router, pathname]);

  const help = ADJUSTMENT_HELP[kind];
  const parsed = /^\d+$/.test(quantity.trim().replace(/,/g, "")) ? Number(quantity.trim().replace(/,/g, "")) : null;
  const after = parsed === null ? null : previewAdjustment(kind, quantityOnHand, parsed);

  return (
    <form action={formAction} onSubmit={submitWithoutReset(formAction)} className="mt-5 space-y-5" noValidate>
      <ErrorSummary state={state} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">What happened?</legend>
        <div className="grid grid-cols-2 gap-2">
          {ADJUSTMENT_KINDS.map((k) => (
            <label
              key={k}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus",
                kind === k ? "border-sage bg-sage-soft text-sage-strong" : "border-line-strong hover:bg-sunken",
              )}
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="accent-sage" />
              {MOVEMENT_LABELS[k]}
            </label>
          ))}
        </div>
      </fieldset>

      <Field id="adjust-quantity" label={help.label} required hint={help.hint} error={e.quantity}>
        <Input
          name="quantity"
          value={quantity}
          onChange={(ev) => setQuantity(ev.target.value)}
          inputMode="numeric"
          autoComplete="off"
          className="tabular w-40"
          {...describedBy("adjust-quantity", { hint: true, error: e.quantity })}
        />
      </Field>

      <p aria-live="polite" className="rounded-control bg-paper px-3 py-2 text-sm">
        {after === null ? (
          <span className="text-ink-muted">Enter a quantity to see the new stock level.</span>
        ) : after < 0 ? (
          <span className="text-danger">That&apos;s more than the {formatCount(quantityOnHand)} on hand.</span>
        ) : (
          <>
            New quantity: <strong className="tabular">{formatCount(after)}</strong>{" "}
            <span className="tabular text-ink-muted">({formatChange(after - quantityOnHand)})</span>
            {after <= reorderLevel && <span className="ml-2 font-medium text-clay-ink">Low stock</span>}
          </>
        )}
      </p>

      <Field id="adjust-note" label="Note" error={e.note} hint="For example a supplier invoice or receipt number.">
        <Input
          name="note"
          value={note}
          onChange={(ev) => setNote(ev.target.value)}
          maxLength={200}
          autoComplete="off"
          {...describedBy("adjust-note", { hint: true, error: e.note })}
        />
      </Field>

      <div className="flex justify-end gap-2">
        <Dialog.Close className={buttonClass("secondary")}>Cancel</Dialog.Close>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save adjustment"}
        </Button>
      </div>
    </form>
  );
}
