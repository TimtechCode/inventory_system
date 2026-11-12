// Shared contracts between the data layer, services, server actions and UI.
// Types and constant tuples only: safe to import from client components.
// All timestamps crossing this boundary are ISO-8601 strings; all money is integer kobo.

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const ATTRIBUTE_INPUT_TYPES = ["TEXT", "NUMBER", "BOOLEAN", "SELECT"] as const;
export type AttributeInputType = (typeof ATTRIBUTE_INPUT_TYPES)[number];

export type CategoryOption = { id: string; name: string; slug: string };

export type CategoryListItem = CategoryOption & {
  description: string | null;
  productCount: number;
  updatedAt: string;
};

export type AttributeOptionDTO = { id: string; value: string; position: number };

export type AttributeDefinitionDTO = {
  id: string;
  code: string;
  name: string;
  inputType: AttributeInputType;
  unit: string | null;
  isRequired: boolean;
  allowsVariants: boolean;
  position: number;
  options: AttributeOptionDTO[]; // ordered by position; empty unless SELECT
};

export type ProductTypeOption = { id: string; name: string; slug: string };

export type ProductTypeDefinition = ProductTypeOption & {
  description: string | null;
  attributes: AttributeDefinitionDTO[]; // ordered by position
};

export type ProductTypeListItem = ProductTypeOption & {
  description: string | null;
  attributeNames: string[];
  variantAttributeNames: string[];
  productCount: number;
  updatedAt: string;
};

/** How many products reference an attribute, as a product-level value or as a variant axis. */
export type AttributeUsage = { products: number; asVariantAxis: number };

export type ProductTypeEditData = ProductTypeDefinition & {
  productCount: number;
  updatedAt: string;
  usage: {
    attributes: Record<string, AttributeUsage>; // attributeId -> usage
    options: Record<string, number>; // optionId -> number of products using it (value or SKU option)
  };
};

// ---------------------------------------------------------------------------
// Stock and pricing
// ---------------------------------------------------------------------------

export const STOCK_STATUSES = ["low", "in-stock"] as const;
/** "low" when quantityOnHand <= reorderLevel, otherwise "in-stock". */
export type StockStatus = (typeof STOCK_STATUSES)[number];

export type StockSummary = {
  totalQuantity: number;
  variantCount: number;
  lowStockCount: number;
  /** "low" if any SKU is low. */
  status: StockStatus;
};

export type PriceRange = { minKobo: number; maxKobo: number };

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export type VariantOptionDTO = {
  attributeId: string;
  attributeName: string;
  optionId: string;
  value: string;
};

export type VariantRow = {
  id: string;
  sku: string;
  /** e.g. "M / Indigo"; "" for the default SKU of a product without variants. */
  label: string;
  options: VariantOptionDTO[]; // ordered by attribute position
  /** Effective price: priceOverrideKobo ?? product.priceKobo. */
  priceKobo: number;
  priceOverrideKobo: number | null;
  quantityOnHand: number;
  reorderLevel: number;
  status: StockStatus;
};

export type ProductListItem = StockSummary & {
  id: string;
  name: string;
  category: CategoryOption;
  productType: ProductTypeOption;
  hasVariants: boolean;
  /** The SKU of a single-SKU product; null when the product has variants. */
  sku: string | null;
  /** The reorder level when all SKUs share one; null means "varies". */
  reorderLevel: number | null;
  price: PriceRange;
  updatedAt: string;
  /** True when the search query matched the product name, category or type (false when q is empty). */
  nameMatchesQuery: boolean;
  variants: (VariantRow & { matchesQuery: boolean })[];
};

export const PRODUCT_SORTS = ["name", "category", "quantity", "price", "status", "updated"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];
export type SortDirection = "asc" | "desc";

export type ProductListQuery = {
  q: string;
  category: string | null; // category slug
  type: string | null; // product type slug
  status: StockStatus | null;
  sort: ProductSort;
  dir: SortDirection;
  page: number; // 1-based
};

export type ProductListResult = {
  items: ProductListItem[];
  /** Normalised query, with page clamped to 1..pageCount. */
  query: ProductListQuery;
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  /** Counts after q/category/type filters but before the status filter. */
  counts: { all: number; low: number; inStock: number };
};

export type ProductAttributeDisplay = {
  attributeId: string;
  name: string;
  inputType: AttributeInputType;
  /** Human-readable value, e.g. "46 cm", "Yes", "Sterling silver". */
  display: string;
};

export type ProductDetail = StockSummary & {
  id: string;
  name: string;
  description: string | null;
  category: CategoryOption;
  productType: ProductTypeOption;
  priceKobo: number;
  price: PriceRange;
  hasVariants: boolean;
  axes: { attributeId: string; name: string }[];
  attributes: ProductAttributeDisplay[];
  variants: VariantRow[];
  createdAt: string;
  updatedAt: string;
};

/** Stored values of a product, shaped for pre-filling the edit form. */
export type ProductFormSource = {
  id: string;
  updatedAt: string;
  name: string;
  description: string;
  categoryId: string;
  productTypeId: string;
  priceKobo: number;
  attributes: Record<
    string,
    {
      textValue: string | null;
      numberValue: number | null;
      booleanValue: boolean | null;
      optionId: string | null;
    }
  >;
  /** Attribute ids used as variant axes; [] for a single-SKU product. */
  axes: string[];
  variants: {
    id: string;
    sku: string;
    options: Record<string, string>; // attributeId -> optionId
    priceOverrideKobo: number | null;
    quantityOnHand: number;
    reorderLevel: number;
  }[];
};

export type ProductFormOptions = {
  categories: CategoryOption[];
  productTypes: ProductTypeDefinition[];
};

export type ProductEditData = {
  product: ProductFormSource;
  categories: CategoryOption[];
  productType: ProductTypeDefinition;
};

// ---------------------------------------------------------------------------
// Stock history
// ---------------------------------------------------------------------------

export const STOCK_MOVEMENT_KINDS = ["INITIAL", "RECEIVED", "SOLD", "RETURNED", "DAMAGED", "COUNT", "EDIT"] as const;
export type StockMovementKind = (typeof STOCK_MOVEMENT_KINDS)[number];

/** Kinds a person can record from the "Adjust stock" dialog. */
export const ADJUSTMENT_KINDS = ["RECEIVED", "SOLD", "RETURNED", "DAMAGED", "COUNT"] as const;
export type AdjustmentKind = (typeof ADJUSTMENT_KINDS)[number];

export type StockMovementRow = {
  id: number;
  kind: StockMovementKind;
  quantityChange: number;
  quantityAfter: number;
  note: string | null;
  createdAt: string;
  /** null when the product has since been deleted. */
  productId: string | null;
  /** Current product name if it still exists, otherwise the name when the movement was recorded. */
  productName: string;
  sku: string;
  variantLabel: string;
};

export type StockHistoryQuery = {
  product: string | null; // product id
  kind: StockMovementKind | null;
  page: number; // 1-based
};

export type StockHistoryResult = {
  items: StockMovementRow[];
  /** Normalised query with page clamped to 1..pageCount. */
  query: StockHistoryQuery;
  /** Name of the filtered product, when filtering by one that exists. */
  productName: string | null;
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

/** Sent by the "Adjust stock" dialog. Strings exactly as typed. */
export type StockAdjustmentInput = {
  variantId: string;
  kind: AdjustmentKind;
  /** Units moved; for COUNT, the counted quantity on hand. */
  quantity: string;
  note: string;
};

// ---------------------------------------------------------------------------
// Input payloads (sent from client forms to server actions; strings exactly as typed)
// ---------------------------------------------------------------------------

export type ProductVariantInput = {
  /** Present for existing SKUs when editing. */
  id?: string;
  /** attributeId -> optionId for every variant axis; {} for the default SKU. */
  options: Record<string, string>;
  sku: string;
  /** Naira as typed, "" = inherit the product price. Must be "" for single-SKU products. */
  priceOverride: string;
  quantityOnHand: string;
  reorderLevel: string;
};

export type ProductInput = {
  name: string;
  description: string;
  categoryId: string;
  productTypeId: string;
  /** Naira as typed, e.g. "18,500" or "₦18,500.50". */
  price: string;
  /**
   * Product-level attribute values: attributeId -> optionId (SELECT), text (TEXT),
   * numeric string (NUMBER) or boolean (BOOLEAN). "" means not set. Axis attributes must be absent.
   */
  attributes: Record<string, string | boolean>;
  /** Attribute ids used as variant axes; [] means a single-SKU product. */
  axes: string[];
  variants: ProductVariantInput[];
};

export type AttributeOptionInput = { id?: string; value: string };

export type AttributeDefinitionInput = {
  /** Present for existing attributes when editing a product type. */
  id?: string;
  name: string;
  inputType: AttributeInputType;
  unit: string;
  isRequired: boolean;
  allowsVariants: boolean;
  options: AttributeOptionInput[];
};

export type ProductTypeInput = {
  name: string;
  description: string;
  attributes: AttributeDefinitionInput[]; // array order = position
};

export type CategoryInput = { name: string; description: string };

// ---------------------------------------------------------------------------
// Results and form state
// ---------------------------------------------------------------------------

/** Field path -> message, e.g. "variants.2.sku", "attributes.<attributeId>", "price". */
export type FieldErrors = Record<string, string>;

export type ServiceError = { formError: string | null; fieldErrors: FieldErrors };

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: ServiceError };

/** State returned by form server actions used with useActionState. */
export type FormState = {
  /** "success" is only used by forms that stay on the page (e.g. dialogs); others redirect. */
  status: "idle" | "error" | "success";
  formError: string | null;
  fieldErrors: FieldErrors;
  /** Increments on every failed submit so the UI can re-focus the error summary. */
  attempt: number;
};

/** Result of non-form mutations (e.g. delete from a confirmation dialog). */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; message: string };
