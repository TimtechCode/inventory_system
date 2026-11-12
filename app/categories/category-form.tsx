"use client";

import { useActionState, useEffect, useState } from "react";

import { useResetOnHide } from "@/components/use-reset-on-hide";
import { Button, LinkButton } from "@/components/ui/button";
import { submitWithoutReset } from "@/components/submit-without-reset";
import { ErrorSummary } from "@/components/ui/error-summary";
import { Field, Input, Textarea, describedBy } from "@/components/ui/field";
import { initialFormState } from "@/lib/validation/form-state";
import type { CategoryListItem, FormState } from "@/lib/types";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  category?: CategoryListItem;
};

export function CategoryForm(props: Props) {
  const { key, markSubmitted, clearSubmitted } = useResetOnHide();
  return <Inner key={key} {...props} onSubmitted={markSubmitted} onFailed={clearSubmitted} />;
}

function Inner({ action, category, onSubmitted, onFailed }: Props & { onSubmitted: () => void; onFailed: () => void }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  useEffect(() => {
    if (state.status === "error") onFailed();
  }, [state, onFailed]);
  const e = state.fieldErrors;
  // Controlled inputs: React resets uncontrolled fields after every action, even failed ones.
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");

  return (
    <form action={formAction} onSubmit={submitWithoutReset(formAction, onSubmitted)} className="space-y-5 rounded-panel border border-line bg-surface p-5" noValidate>
      {category && <input type="hidden" name="updatedAt" value={category.updatedAt} />}
      <ErrorSummary state={state} />
      <Field id="name" label="Name" required error={e.name}>
        <Input name="name" value={name} onChange={(ev) => setName(ev.target.value)} maxLength={60} autoComplete="off" {...describedBy("name", { error: e.name })} />
      </Field>
      <Field id="description" label="Description" error={e.description}>
        <Textarea name="description" value={description} onChange={(ev) => setDescription(ev.target.value)} rows={3} maxLength={500} {...describedBy("description", { error: e.description })} />
      </Field>
      <div className="flex justify-end gap-2">
        <LinkButton href="/categories" variant="secondary">
          Cancel
        </LinkButton>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : category ? "Save changes" : "Add category"}
        </Button>
      </div>
    </form>
  );
}
