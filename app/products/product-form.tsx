"use client";

import { RotateCcw, X } from "lucide-react";
import { type ReactNode, useActionState, useEffect, useMemo, useState } from "react";

import { useResetOnHide } from "@/components/use-reset-on-hide";
import { Button, LinkButton } from "@/components/ui/button";
import { submitWithoutReset } from "@/components/submit-without-reset";
import { ErrorSummary } from "@/components/ui/error-summary";
import { Field, FieldError, Input, Select, Textarea, controlClass, describedBy } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";
import { koboToNairaInput } from "@/lib/money";
import { suggestSku } from "@/lib/slug";
import { initialFormState } from "@/lib/validation/form-state";
import type {
  AttributeDefinitionDTO,
  CategoryOption,
  FormState,
  ProductFormSource,
  ProductInput,
  ProductTypeDefinition,
} from "@/lib/types";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

type Props = {
  action: Action;
  categories: CategoryOption[];
  productTypes: ProductTypeDefinition[];
  /** Present when editing: the product type is then fixed. */
  product?: ProductFormSource;
  cancelHref: string;
};

export function ProductForm(props: Props) {
  const { key, markSubmitted, clearSubmitted } = useResetOnHide();
  return <ProductFormInner key={key} {...props} onSubmitted={markSubmitted} onFailed={clearSubmitted} />;
}

type Row = {
  id?: string;
  options: Record<string, string>;
  sku: string;
  skuTouched: boolean;
  priceOverride: string;
  quantityOnHand: string;
  reorderLevel: string;
};

function keyOf(options: Record<string, string>, axes: string[]): string {
  return axes.map((a) => options[a] ?? "").join("|");
}

function combinations(axes: string[], selected: Record<string, string[]>): Record<string, string>[] {
  let combos: Record<string, string>[] = [{}];
  for (const axis of axes) {
    const values = selected[axis] ?? [];
    combos = combos.flatMap((c) => values.map((v) => ({ ...c, [axis]: v })));
  }
  return axes.length === 0 ? [] : combos;
}

function initialAttributes(product: ProductFormSource | undefined, type: ProductTypeDefinition | undefined) {
  const values: Record<string, string | boolean> = {};
  if (!product || !type) return values;
  for (const a of type.attributes) {
    const v = product.attributes[a.id];
    if (!v) continue;
    if (a.inputType === "TEXT" && v.textValue !== null) values[a.id] = v.textValue;
    if (a.inputType === "NUMBER" && v.numberValue !== null) values[a.id] = String(v.numberValue);
    if (a.inputType === "BOOLEAN" && v.booleanValue !== null) values[a.id] = v.booleanValue ? "true" : "false";
    if (a.inputType === "SELECT" && v.optionId !== null) values[a.id] = v.optionId;
  }
  return values;
}

function ProductFormInner({
  action,
  categories,
  productTypes,
  product,
  cancelHref,
  onSubmitted,
  onFailed,
}: Props & { onSubmitted: () => void; onFailed: () => void }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const errors = state.fieldErrors;
  useEffect(() => {
    if (state.status === "error") onFailed();
  }, [state, onFailed]);

  const editing = Boolean(product);
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [productTypeId, setProductTypeId] = useState(product?.productTypeId ?? (productTypes.length === 1 ? productTypes[0].id : ""));
  const [price, setPrice] = useState(product ? koboToNairaInput(product.priceKobo) : "");
  const type = productTypes.find((t) => t.id === productTypeId);
  const [attributes, setAttributes] = useState(() => initialAttributes(product, type));

  // Variant state
  const [axes, setAxes] = useState<string[]>(product?.axes ?? []);
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const s: Record<string, string[]> = {};
    for (const axis of product?.axes ?? []) {
      s[axis] = [...new Set(product!.variants.map((v) => v.options[axis]).filter(Boolean))];
    }
    return s;
  });
  const [rows, setRows] = useState<Record<string, Row>>(() => {
    const r: Record<string, Row> = {};
    for (const v of product?.variants ?? []) {
      r[keyOf(v.options, product!.axes)] = {
        id: v.id,
        options: v.options,
        sku: v.sku,
        skuTouched: true,
        priceOverride: v.priceOverrideKobo === null ? "" : koboToNairaInput(v.priceOverrideKobo),
        quantityOnHand: String(v.quantityOnHand),
        reorderLevel: String(v.reorderLevel),
      };
    }
    return r;
  });
  const [excluded, setExcluded] = useState<Set<string>>(() => {
    if (!product || product.axes.length === 0) return new Set();
    const existing = new Set(product.variants.map((v) => keyOf(v.options, product.axes)));
    const sel: Record<string, string[]> = {};
    for (const axis of product.axes) sel[axis] = [...new Set(product.variants.map((v) => v.options[axis]))];
    return new Set(combinations(product.axes, sel).map((c) => keyOf(c, product.axes)).filter((k) => !existing.has(k)));
  });

  // Single-SKU state
  const single = product && product.axes.length === 0 ? product.variants[0] : undefined;
  const [singleRow, setSingleRow] = useState<Row>({
    id: single?.id,
    options: {},
    sku: single?.sku ?? "",
    skuTouched: Boolean(single),
    priceOverride: "",
    quantityOnHand: single ? String(single.quantityOnHand) : "0",
    reorderLevel: single ? String(single.reorderLevel) : "0",
  });
  const [bulkReorder, setBulkReorder] = useState("");

  const attrById = useMemo(() => new Map((type?.attributes ?? []).map((a) => [a.id, a])), [type]);
  const variantAttributes = (type?.attributes ?? []).filter((a) => a.inputType === "SELECT" && a.allowsVariants);
  const orderedAxes = variantAttributes.map((a) => a.id).filter((id) => axes.includes(id));

  const optionValue = (attributeId: string, optionId: string) =>
    attrById.get(attributeId)?.options.find((o) => o.id === optionId)?.value ?? "";

  const combos = combinations(orderedAxes, selected).filter((c) => !excluded.has(keyOf(c, orderedAxes)));
  const variantRows: Row[] = combos.map((options) => {
    const existing = rows[keyOf(options, orderedAxes)];
    const values = orderedAxes.map((a) => optionValue(a, options[a]));
    const auto = suggestSku(name, values);
    if (existing) return { ...existing, options, sku: existing.skuTouched ? existing.sku : auto };
    return { options, sku: auto, skuTouched: false, priceOverride: "", quantityOnHand: "0", reorderLevel: "0" };
  });
  const effectiveSingle: Row = { ...singleRow, sku: singleRow.skuTouched ? singleRow.sku : suggestSku(name) };

  const updateRow = (row: Row, patch: Partial<Row>) => {
    const k = keyOf(row.options, orderedAxes);
    setRows((r) => ({ ...r, [k]: { ...row, ...patch } }));
  };

  function changeType(id: string) {
    setProductTypeId(id);
    setAttributes({});
    setAxes([]);
    setSelected({});
    setRows({});
    setExcluded(new Set());
  }

  function toggleAxis(attributeId: string, on: boolean) {
    setAxes((current) => (on ? [...current, attributeId] : current.filter((a) => a !== attributeId)));
    // A variant attribute is not also a product-level value.
    setAttributes((a) => {
      const next = { ...a };
      delete next[attributeId];
      return next;
    });
    setExcluded(new Set());
  }

  function toggleOption(attributeId: string, optionId: string, on: boolean) {
    setSelected((s) => {
      const current = s[attributeId] ?? [];
      const options = attrById.get(attributeId)?.options.map((o) => o.id) ?? [];
      const next = on ? options.filter((o) => o === optionId || current.includes(o)) : current.filter((o) => o !== optionId);
      return { ...s, [attributeId]: next };
    });
  }

  const payload: ProductInput = {
    name,
    description,
    categoryId,
    productTypeId,
    price,
    attributes: Object.fromEntries(Object.entries(attributes).filter(([id]) => !orderedAxes.includes(id) && attrById.has(id))),
    axes: orderedAxes,
    variants: (orderedAxes.length === 0 ? [effectiveSingle] : variantRows).map((r) => ({
      ...(r.id ? { id: r.id } : {}),
      options: orderedAxes.length === 0 ? {} : r.options,
      sku: r.sku,
      priceOverride: orderedAxes.length === 0 ? "" : r.priceOverride,
      quantityOnHand: r.quantityOnHand,
      reorderLevel: r.reorderLevel,
    })),
  };

  return (
    <form action={formAction} onSubmit={submitWithoutReset(formAction, onSubmitted)} className="space-y-6" noValidate>
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      {product && <input type="hidden" name="updatedAt" value={product.updatedAt} />}
      <ErrorSummary state={state} />

      <Section title="Basics">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="name" label="Product name" required error={errors.name} className="sm:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="off" {...describedBy("name", { error: errors.name })} />
          </Field>
          <Field id="categoryId" label="Category" required error={errors.categoryId}>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} {...describedBy("categoryId", { error: errors.categoryId })}>
              <option value="">Choose a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="productTypeId"
            label="Product type"
            required
            error={errors.productTypeId}
            hint={editing ? "The type can't be changed after a product is created." : "Decides which details and variants this product has."}
          >
            <Select
              value={productTypeId}
              onChange={(e) => changeType(e.target.value)}
              disabled={editing}
              {...describedBy("productTypeId", { hint: true, error: errors.productTypeId })}
            >
              <option value="">Choose a product type</option>
              {productTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="price"
            label="Sales price (₦)"
            required
            error={errors.price}
            hint={orderedAxes.length > 0 ? "Variants use this price unless you set their own." : undefined}
          >
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
                ₦
              </span>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="18,500"
                className="tabular pl-7"
                {...describedBy("price", { hint: orderedAxes.length > 0, error: errors.price })}
              />
            </div>
          </Field>
          <Field id="description" label="Description" error={errors.description} className="sm:col-span-2">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} {...describedBy("description", { error: errors.description })} />
          </Field>
        </div>
      </Section>

      {type && (
        <>
          {variantAttributes.length > 0 && (
            <Section
              title="Variants"
              description="Create one SKU for each combination, e.g. every size in each colour. Leave these unticked for a product sold as a single SKU."
            >
              {errors.axes && <FieldError>{errors.axes}</FieldError>}
              <fieldset className="space-y-4">
                <legend className="sr-only">Variant attributes</legend>
                {variantAttributes.map((a) => {
                  const on = orderedAxes.includes(a.id);
                  return (
                    <div key={a.id} className="rounded-control border border-line p-3">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input type="checkbox" checked={on} onChange={(e) => toggleAxis(a.id, e.target.checked)} className="size-4 accent-sage" />
                        Varies by {a.name.toLowerCase()}
                      </label>
                      {on && (
                        <fieldset className="mt-3">
                          <legend className="mb-2 text-sm text-ink-muted">Which {a.name.toLowerCase()} values do you stock?</legend>
                          <div className="flex flex-wrap gap-2">
                            {a.options.map((o) => {
                              const checked = (selected[a.id] ?? []).includes(o.id);
                              return (
                                <label
                                  key={o.id}
                                  className={cn(
                                    "cursor-pointer rounded-control border px-3 py-1.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus",
                                    checked ? "border-sage bg-sage-soft text-sage-strong" : "border-line-strong hover:bg-sunken",
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={checked}
                                    onChange={(e) => toggleOption(a.id, o.id, e.target.checked)}
                                  />
                                  {o.value}
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>
                      )}
                    </div>
                  );
                })}
              </fieldset>
            </Section>
          )}

          <AttributeSection type={type} axes={orderedAxes} values={attributes} setValues={setAttributes} errors={errors} />

          <Section
            title={orderedAxes.length > 0 ? `SKUs (${variantRows.length})` : "Stock"}
            description="A SKU shows as low stock when its quantity is at or below its reorder level."
          >
            {errors.variants && <FieldError>{errors.variants}</FieldError>}
            {orderedAxes.length === 0 ? (
              <div className="grid gap-5 sm:grid-cols-3">
                <Field id="sku" label="SKU" required error={errors["variants.0.sku"]} hint="Suggested from the name; edit if you like.">
                  <Input
                    value={effectiveSingle.sku}
                    onChange={(e) => setSingleRow({ ...effectiveSingle, sku: e.target.value, skuTouched: true })}
                    className="font-mono uppercase"
                    {...describedBy("sku", { hint: true, error: errors["variants.0.sku"] })}
                  />
                </Field>
                <Field id="qty" label="Quantity on hand" required error={errors["variants.0.quantityOnHand"]}>
                  <Input
                    value={singleRow.quantityOnHand}
                    inputMode="numeric"
                    onChange={(e) => setSingleRow({ ...effectiveSingle, quantityOnHand: e.target.value })}
                    className="tabular"
                    {...describedBy("qty", { error: errors["variants.0.quantityOnHand"] })}
                  />
                </Field>
                <Field id="reorder" label="Reorder level" required error={errors["variants.0.reorderLevel"]}>
                  <Input
                    value={singleRow.reorderLevel}
                    inputMode="numeric"
                    onChange={(e) => setSingleRow({ ...effectiveSingle, reorderLevel: e.target.value })}
                    className="tabular"
                    {...describedBy("reorder", { error: errors["variants.0.reorderLevel"] })}
                  />
                </Field>
              </div>
            ) : variantRows.length === 0 ? (
              <p className="rounded-control bg-sunken px-4 py-6 text-center text-sm text-ink-muted">
                Choose at least one value for {orderedAxes.map((a) => attrById.get(a)?.name.toLowerCase()).join(" and ")} above.
              </p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-end gap-2">
                  <div>
                    <label htmlFor="bulk-reorder" className="mb-1 block text-sm text-ink-muted">
                      Reorder level for all SKUs
                    </label>
                    <Input id="bulk-reorder" value={bulkReorder} onChange={(e) => setBulkReorder(e.target.value)} inputMode="numeric" className="tabular w-32" />
                  </div>
                  <Button
                    variant="secondary"
                    disabled={bulkReorder.trim() === ""}
                    onClick={() => {
                      setRows((r) => {
                        const next = { ...r };
                        for (const row of variantRows) next[keyOf(row.options, orderedAxes)] = { ...row, reorderLevel: bulkReorder };
                        return next;
                      });
                    }}
                  >
                    Apply
                  </Button>
                  {excluded.size > 0 && (
                    <Button variant="ghost" onClick={() => setExcluded(new Set())}>
                      <RotateCcw aria-hidden />
                      Restore {plural(excluded.size, "removed combination")}
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto rounded-control border border-line">
                  <table className="w-full min-w-[44rem] text-sm">
                    <thead className="bg-paper text-left text-ink-muted">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-medium">Variant</th>
                        <th scope="col" className="px-3 py-2 font-medium">SKU</th>
                        <th scope="col" className="px-3 py-2 font-medium">Price (₦)</th>
                        <th scope="col" className="px-3 py-2 font-medium">On hand</th>
                        <th scope="col" className="px-3 py-2 font-medium">Reorder at</th>
                        <th scope="col" className="px-3 py-2"><span className="sr-only">Remove</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {variantRows.map((row, i) => {
                        const label = orderedAxes.map((a) => optionValue(a, row.options[a])).join(" / ");
                        const e = (f: string) => errors[`variants.${i}.${f}`];
                        const rowErrors = ["options", "sku", "priceOverride", "quantityOnHand", "reorderLevel"].map(e).filter(Boolean);
                        return (
                          <tr key={keyOf(row.options, orderedAxes)} className="align-top">
                            <th scope="row" className="px-3 py-2 text-left font-medium">
                              {label}
                              {rowErrors.length > 0 && (
                                <ul id={`variant-${i}-errors`} className="mt-1 space-y-0.5 text-xs font-medium text-danger">
                                  {rowErrors.map((msg) => (
                                    <li key={msg}>{msg}</li>
                                  ))}
                                </ul>
                              )}
                            </th>
                            <td className="px-3 py-2">
                              <CellInput
                                label={`SKU for ${label}`}
                                value={row.sku}
                                invalid={Boolean(e("sku"))}
                                describedBy={rowErrors.length ? `variant-${i}-errors` : undefined}
                                className="w-48 font-mono uppercase"
                                onChange={(v) => updateRow(row, { sku: v, skuTouched: true })}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <CellInput
                                label={`Price for ${label}`}
                                value={row.priceOverride}
                                placeholder={price || "Base price"}
                                invalid={Boolean(e("priceOverride"))}
                                describedBy={rowErrors.length ? `variant-${i}-errors` : undefined}
                                inputMode="decimal"
                                className="w-28"
                                onChange={(v) => updateRow(row, { priceOverride: v })}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <CellInput
                                label={`Quantity on hand for ${label}`}
                                value={row.quantityOnHand}
                                invalid={Boolean(e("quantityOnHand"))}
                                describedBy={rowErrors.length ? `variant-${i}-errors` : undefined}
                                inputMode="numeric"
                                className="w-20"
                                onChange={(v) => updateRow(row, { quantityOnHand: v })}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <CellInput
                                label={`Reorder level for ${label}`}
                                value={row.reorderLevel}
                                invalid={Boolean(e("reorderLevel"))}
                                describedBy={rowErrors.length ? `variant-${i}-errors` : undefined}
                                inputMode="numeric"
                                className="w-20"
                                onChange={(v) => updateRow(row, { reorderLevel: v })}
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  updateRow(row, {});
                                  setExcluded((x) => new Set(x).add(keyOf(row.options, orderedAxes)));
                                }}
                              >
                                <X aria-hidden />
                                <span className="sr-only">Remove {label}</span>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-sm text-ink-muted">Leave a price blank to use the product price.</p>
              </>
            )}
          </Section>
        </>
      )}

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-panel sm:border">
        <LinkButton href={cancelHref} variant="secondary">
          Cancel
        </LinkButton>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Add product"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-panel border border-line bg-surface p-5">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function CellInput({
  label,
  value,
  onChange,
  invalid,
  describedBy: describedById,
  className,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  describedBy?: string;
  className?: string;
  placeholder?: string;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <input
      aria-label={label}
      value={value}
      placeholder={placeholder}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      aria-describedby={describedById}
      className={cn(controlClass, "tabular h-9", className)}
    />
  );
}

function AttributeSection({
  type,
  axes,
  values,
  setValues,
  errors,
}: {
  type: ProductTypeDefinition;
  axes: string[];
  values: Record<string, string | boolean>;
  setValues: (fn: (v: Record<string, string | boolean>) => Record<string, string | boolean>) => void;
  errors: Record<string, string>;
}) {
  const fields = type.attributes.filter((a) => !axes.includes(a.id));
  if (fields.length === 0) return null;
  const set = (id: string, value: string) => setValues((v) => ({ ...v, [id]: value }));

  return (
    <Section title={`${type.name} details`}>
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((a) => (
          <AttributeField key={a.id} attribute={a} value={values[a.id]} onChange={(v) => set(a.id, v)} error={errors[`attributes.${a.id}`]} />
        ))}
      </div>
      {errors.attributes && <FieldError>{errors.attributes}</FieldError>}
    </Section>
  );
}

function AttributeField({
  attribute: a,
  value,
  onChange,
  error,
}: {
  attribute: AttributeDefinitionDTO;
  value: string | boolean | undefined;
  onChange: (value: string) => void;
  error?: string;
}) {
  const id = `attr-${a.id}`;
  const str = value === undefined ? "" : String(value);
  const aria = describedBy(id, { error });
  switch (a.inputType) {
    case "SELECT":
      return (
        <Field id={id} label={a.name} required={a.isRequired} error={error}>
          <Select value={str} onChange={(e) => onChange(e.target.value)} {...aria}>
            <option value="">{a.isRequired ? `Choose ${a.name.toLowerCase()}` : "Not set"}</option>
            {a.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.value}
              </option>
            ))}
          </Select>
        </Field>
      );
    case "BOOLEAN":
      return (
        <Field id={id} label={a.name} required={a.isRequired} error={error}>
          <Select value={str} onChange={(e) => onChange(e.target.value)} {...aria}>
            <option value="">Not set</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </Select>
        </Field>
      );
    case "NUMBER":
      return (
        <Field id={id} label={a.unit ? `${a.name} (${a.unit})` : a.name} required={a.isRequired} error={error}>
          <Input value={str} inputMode="decimal" onChange={(e) => onChange(e.target.value)} className="tabular" {...aria} />
        </Field>
      );
    case "TEXT":
      return (
        <Field id={id} label={a.name} required={a.isRequired} error={error}>
          <Input value={str} maxLength={200} onChange={(e) => onChange(e.target.value)} {...aria} />
        </Field>
      );
  }
}
