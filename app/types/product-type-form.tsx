"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useActionState, useEffect, useId, useState } from "react";

import { useResetOnHide } from "@/components/use-reset-on-hide";
import { Button, LinkButton } from "@/components/ui/button";
import { ErrorSummary } from "@/components/ui/error-summary";
import { Field, FieldError, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import { plural } from "@/lib/format";
import { initialFormState } from "@/lib/validation/form-state";
import type { AttributeInputType, FormState, ProductTypeEditData, ProductTypeInput } from "@/lib/types";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  productType?: ProductTypeEditData;
};

const INPUT_TYPE_LABELS: Record<AttributeInputType, string> = {
  SELECT: "List of options",
  TEXT: "Text",
  NUMBER: "Number",
  BOOLEAN: "Yes / no",
};

type AttrRow = {
  key: string;
  id?: string;
  name: string;
  inputType: AttributeInputType;
  unit: string;
  isRequired: boolean;
  allowsVariants: boolean;
  options: { key: string; id?: string; value: string }[];
};

let counter = 0;
const newKey = () => `new-${++counter}`;

export function ProductTypeForm(props: Props) {
  const { key, markSubmitted, clearSubmitted } = useResetOnHide();
  return <Inner key={key} {...props} onSubmitted={markSubmitted} onFailed={clearSubmitted} />;
}

function Inner({ action, productType, onSubmitted, onFailed }: Props & { onSubmitted: () => void; onFailed: () => void }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  useEffect(() => {
    if (state.status === "error") onFailed();
  }, [state, onFailed]);
  const e = state.fieldErrors;

  const [name, setName] = useState(productType?.name ?? "");
  const [description, setDescription] = useState(productType?.description ?? "");
  const [attrs, setAttrs] = useState<AttrRow[]>(() =>
    (productType?.attributes ?? []).map((a) => ({
      key: a.id,
      id: a.id,
      name: a.name,
      inputType: a.inputType,
      unit: a.unit ?? "",
      isRequired: a.isRequired,
      allowsVariants: a.allowsVariants,
      options: a.options.map((o) => ({ key: o.id, id: o.id, value: o.value })),
    })),
  );

  const update = (key: string, patch: Partial<AttrRow>) => setAttrs((list) => list.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  const move = (index: number, by: number) =>
    setAttrs((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });

  const payload: ProductTypeInput = {
    name,
    description,
    attributes: attrs.map((a) => ({
      ...(a.id ? { id: a.id } : {}),
      name: a.name,
      inputType: a.inputType,
      unit: a.unit,
      isRequired: a.isRequired,
      allowsVariants: a.inputType === "SELECT" && a.allowsVariants,
      options: a.inputType === "SELECT" ? a.options.map((o) => ({ ...(o.id ? { id: o.id } : {}), value: o.value })) : [],
    })),
  };

  return (
    <form action={formAction} onSubmit={onSubmitted} className="space-y-6" noValidate>
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      {productType && <input type="hidden" name="updatedAt" value={productType.updatedAt} />}
      <ErrorSummary state={state} />

      <section className="space-y-5 rounded-panel border border-line bg-surface p-5">
        <Field id="name" label="Name" required error={e.name} hint="For example Apparel, Footwear or Watch.">
          <Input value={name} onChange={(ev) => setName(ev.target.value)} maxLength={60} autoComplete="off" {...describedBy("name", { hint: true, error: e.name })} />
        </Field>
        <Field id="description" label="Description" error={e.description}>
          <Textarea value={description} onChange={(ev) => setDescription(ev.target.value)} rows={2} maxLength={500} {...describedBy("description", { error: e.description })} />
        </Field>
      </section>

      <section className="rounded-panel border border-line bg-surface p-5">
        <h2 className="font-semibold">Attributes</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Details recorded for every product of this type. Turn on <strong className="font-medium text-ink">Creates variants</strong> for
          list attributes like size or colour that need one SKU per value.
        </p>

        <ol className="mt-4 space-y-3">
          {attrs.map((a, i) => {
            const usage = a.id ? productType?.usage.attributes[a.id] : undefined;
            const inUse = Boolean(usage && (usage.products > 0 || usage.asVariantAxis > 0));
            return (
              <AttributeEditor
                key={a.key}
                index={i}
                count={attrs.length}
                row={a}
                inUse={inUse}
                usageText={
                  usage && inUse
                    ? usage.asVariantAxis > 0
                      ? `Defines SKUs for ${plural(usage.asVariantAxis, "product")}`
                      : `Used by ${plural(usage.products, "product")}`
                    : null
                }
                optionUsage={productType?.usage.options ?? {}}
                errors={e}
                onChange={(patch) => update(a.key, patch)}
                onMove={(by) => move(i, by)}
                onRemove={() => setAttrs((list) => list.filter((x) => x.key !== a.key))}
              />
            );
          })}
        </ol>
        {attrs.length === 0 && <p className="mt-4 rounded-control bg-sunken px-4 py-6 text-center text-sm text-ink-muted">No attributes yet.</p>}

        <Button
          variant="secondary"
          className="mt-4"
          onClick={() =>
            setAttrs((list) => [
              ...list,
              { key: newKey(), name: "", inputType: "SELECT", unit: "", isRequired: false, allowsVariants: false, options: [{ key: newKey(), value: "" }] },
            ])
          }
        >
          <Plus aria-hidden />
          Add attribute
        </Button>
      </section>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-panel sm:border">
        <LinkButton href="/types" variant="secondary">
          Cancel
        </LinkButton>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : productType ? "Save changes" : "Add product type"}
        </Button>
      </div>
    </form>
  );
}

function AttributeEditor({
  index,
  count,
  row: a,
  inUse,
  usageText,
  optionUsage,
  errors,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  row: AttrRow;
  inUse: boolean;
  usageText: string | null;
  optionUsage: Record<string, number>;
  errors: Record<string, string>;
  onChange: (patch: Partial<AttrRow>) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  const uid = useId();
  const path = `attributes.${index}`;
  const label = a.name.trim() || `Attribute ${index + 1}`;
  const nameId = `${uid}-name`;
  const typeId = `${uid}-type`;
  const unitId = `${uid}-unit`;

  return (
    <li className="rounded-control border border-line p-4">
      <div className="flex flex-wrap items-start gap-4">
        <Field id={nameId} label="Attribute name" required error={errors[`${path}.name`]} className="min-w-48 flex-1">
          <Input value={a.name} onChange={(ev) => onChange({ name: ev.target.value })} maxLength={40} placeholder="e.g. Size" {...describedBy(nameId, { error: errors[`${path}.name`] })} />
        </Field>
        <Field
          id={typeId}
          label="Input"
          required
          error={errors[`${path}.inputType`]}
          hint={inUse ? "Locked while in use" : undefined}
          className="w-48"
        >
          <Select
            value={a.inputType}
            disabled={inUse}
            onChange={(ev) => onChange({ inputType: ev.target.value as AttributeInputType })}
            {...describedBy(typeId, { hint: inUse, error: errors[`${path}.inputType`] })}
          >
            {(Object.keys(INPUT_TYPE_LABELS) as AttributeInputType[]).map((t) => (
              <option key={t} value={t}>
                {INPUT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        {a.inputType === "NUMBER" && (
          <Field id={unitId} label="Unit" error={errors[`${path}.unit`]} className="w-28">
            <Input value={a.unit} onChange={(ev) => onChange({ unit: ev.target.value })} maxLength={10} placeholder="cm" {...describedBy(unitId, { error: errors[`${path}.unit`] })} />
          </Field>
        )}
        <div className="ml-auto flex gap-1 pt-7">
          <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp aria-hidden />
            <span className="sr-only">Move {label} up</span>
          </Button>
          <Button variant="ghost" size="sm" disabled={index === count - 1} onClick={() => onMove(1)}>
            <ArrowDown aria-hidden />
            <span className="sr-only">Move {label} down</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onRemove} className="text-danger" disabled={inUse} title={inUse ? "In use by products" : undefined}>
            <Trash2 aria-hidden />
            <span className="sr-only">Remove {label}</span>
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-sage" checked={a.isRequired} onChange={(ev) => onChange({ isRequired: ev.target.checked })} />
          Required
        </label>
        {a.inputType === "SELECT" && (
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4 accent-sage" checked={a.allowsVariants} onChange={(ev) => onChange({ allowsVariants: ev.target.checked })} />
            Creates variants (one SKU per option)
          </label>
        )}
        {usageText && <span className="text-ink-muted">{usageText}</span>}
      </div>
      {errors[`${path}.allowsVariants`] && <FieldError>{errors[`${path}.allowsVariants`]}</FieldError>}

      {a.inputType === "SELECT" && (
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium">Options for {label}</legend>
          <ul className="flex flex-wrap gap-2">
            {a.options.map((o, j) => {
              const used = o.id ? (optionUsage[o.id] ?? 0) : 0;
              const err = errors[`${path}.options.${j}`];
              return (
                <li key={o.key}>
                  <div className="flex items-center rounded-control border border-line-strong bg-surface focus-within:border-sage aria-[invalid=true]:border-danger" aria-invalid={err ? true : undefined}>
                    <input
                      aria-label={`Option ${j + 1} for ${label}`}
                      value={o.value}
                      maxLength={40}
                      onChange={(ev) => onChange({ options: a.options.map((x) => (x.key === o.key ? { ...x, value: ev.target.value } : x)) })}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") {
                          ev.preventDefault();
                          onChange({ options: [...a.options, { key: newKey(), value: "" }] });
                        }
                      }}
                      className="h-8 w-28 rounded-l-control bg-transparent px-2 text-sm focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={used > 0}
                      title={used > 0 ? `Used by ${plural(used, "product")}` : undefined}
                      onClick={() => onChange({ options: a.options.filter((x) => x.key !== o.key) })}
                      className="px-1.5 text-ink-muted hover:text-danger disabled:opacity-30"
                    >
                      <X aria-hidden className="size-3.5" />
                      <span className="sr-only">Remove option {o.value || j + 1}</span>
                    </button>
                  </div>
                  {err && <p className="mt-1 max-w-40 text-xs text-danger">{err}</p>}
                </li>
              );
            })}
            <li>
              <Button variant="ghost" size="sm" onClick={() => onChange({ options: [...a.options, { key: newKey(), value: "" }] })}>
                <Plus aria-hidden />
                Add option
              </Button>
            </li>
          </ul>
          {errors[`${path}.options`] && <FieldError>{errors[`${path}.options`]}</FieldError>}
        </fieldset>
      )}
    </li>
  );
}
