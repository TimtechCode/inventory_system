"use client";

import { type FormEvent, startTransition } from "react";

/**
 * onSubmit handler for forms driven by useActionState. React resets a form after its `action`
 * runs, even when the action fails, which puts controlled radios and checkboxes back to their
 * initial DOM state while React state says otherwise. Dispatching manually skips that reset.
 * Keep `action={formAction}` on the form too: it still handles submits made before hydration.
 */
export function submitWithoutReset(dispatch: (formData: FormData) => void, before?: () => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    before?.();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  };
}
