// Demo catalogue for People's Shop. Safe to run repeatedly: categories and product types are
// upserted by slug, attributes by code, options by value, and products are skipped when any of
// their SKUs already exists.
import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../generated/prisma/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and try again.");
const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

type InputType = "TEXT" | "NUMBER" | "BOOLEAN" | "SELECT";
type AttrSeed = {
  code: string;
  name: string;
  inputType: InputType;
  unit?: string;
  isRequired?: boolean;
  allowsVariants?: boolean;
  options?: string[];
};

const categories = [
  { slug: "footwear", name: "Footwear", description: "Shoes, sandals and slippers." },
  { slug: "clothing", name: "Clothing", description: "Ready-to-wear for women, men and children." },
  { slug: "watches-and-jewellery", name: "Watches & Jewellery", description: "Wristwatches, necklaces and bracelets." },
  { slug: "bags", name: "Bags", description: "Handbags, backpacks and travel bags." },
  { slug: "home-and-kitchen", name: "Home & Kitchen", description: "Cookware, storage and tableware." },
];

const types: { slug: string; name: string; description: string; attributes: AttrSeed[] }[] = [
  {
    slug: "footwear",
    name: "Footwear",
    description: "Sold by EU size; colour may also define SKUs.",
    attributes: [
      { code: "shoe_size", name: "Shoe size (EU)", inputType: "SELECT", allowsVariants: true, options: ["38", "39", "40", "41", "42", "43", "44", "45"] },
      { code: "colour", name: "Colour", inputType: "SELECT", allowsVariants: true, options: ["Black", "Brown", "Tan", "White"] },
      { code: "upper_material", name: "Upper material", inputType: "TEXT" },
    ],
  },
  {
    slug: "apparel",
    name: "Apparel",
    description: "Garments sold by size and colour.",
    attributes: [
      { code: "size", name: "Size", inputType: "SELECT", allowsVariants: true, options: ["XS", "S", "M", "L", "XL", "XXL"] },
      { code: "colour", name: "Colour", inputType: "SELECT", allowsVariants: true, options: ["Indigo", "Mustard", "Emerald", "Black", "White"] },
      { code: "fabric", name: "Fabric", inputType: "SELECT", isRequired: true, options: ["Ankara cotton", "Adire", "Linen", "Aso-oke"] },
      { code: "made_in_nigeria", name: "Made in Nigeria", inputType: "BOOLEAN" },
    ],
  },
  {
    slug: "watch",
    name: "Watch",
    description: "Wristwatches; one SKU per model.",
    attributes: [
      { code: "movement", name: "Movement", inputType: "SELECT", isRequired: true, options: ["Quartz", "Automatic", "Digital"] },
      { code: "strap", name: "Strap", inputType: "SELECT", allowsVariants: true, options: ["Leather", "Steel", "Silicone"] },
      { code: "case_diameter", name: "Case diameter", inputType: "NUMBER", unit: "mm" },
      { code: "water_resistant", name: "Water resistant", inputType: "BOOLEAN" },
    ],
  },
  {
    slug: "jewellery",
    name: "Jewellery",
    description: "Necklaces, bracelets and earrings.",
    attributes: [
      { code: "metal", name: "Metal", inputType: "SELECT", allowsVariants: true, options: ["Sterling silver", "Gold-plated", "Brass"] },
      { code: "length", name: "Length", inputType: "NUMBER", unit: "cm" },
      { code: "stone", name: "Stone", inputType: "TEXT" },
    ],
  },
  {
    slug: "bag",
    name: "Bag",
    description: "Bags and luggage.",
    attributes: [
      { code: "colour", name: "Colour", inputType: "SELECT", allowsVariants: true, options: ["Black", "Brown", "Navy", "Red"] },
      { code: "capacity", name: "Capacity", inputType: "NUMBER", unit: "L" },
      { code: "material", name: "Material", inputType: "TEXT", isRequired: true },
    ],
  },
  {
    slug: "kitchenware",
    name: "Kitchenware",
    description: "Pots, flasks and kitchen tools.",
    attributes: [
      { code: "capacity", name: "Capacity", inputType: "NUMBER", unit: "L" },
      { code: "material", name: "Material", inputType: "TEXT" },
      { code: "dishwasher_safe", name: "Dishwasher safe", inputType: "BOOLEAN" },
    ],
  },
];

type Value = string | number | boolean;
type VariantSeed = { sku: string; options?: Record<string, string>; price?: number; qty: number; reorder: number };
type ProductSeed = {
  name: string;
  description?: string;
  category: string;
  type: string;
  price: number; // naira
  values?: Record<string, Value>;
  variants: VariantSeed[];
};

function sizes(prefix: string, list: string[], extra: Record<string, string>, stock: number[], reorder: number): VariantSeed[] {
  return list.map((size, i) => ({
    sku: `${prefix}-${size}`,
    options: { ...extra, size },
    qty: stock[i] ?? 0,
    reorder,
  }));
}

const products: ProductSeed[] = [
  {
    name: "Ankara Wrap Dress",
    description: "Knee-length wrap dress in bold wax print with a self-tie waist.",
    category: "clothing",
    type: "apparel",
    price: 18_500,
    values: { fabric: "Ankara cotton", made_in_nigeria: true },
    variants: [
      ...sizes("AWD-IND", ["S", "M", "L", "XL"], { colour: "Indigo" }, [6, 2, 9, 4], 3),
      ...sizes("AWD-MUS", ["S", "M", "L"], { colour: "Mustard" }, [5, 7, 1], 3),
    ],
  },
  {
    name: "Adire Kaftan",
    description: "Hand-dyed loose kaftan from Abeokuta.",
    category: "clothing",
    type: "apparel",
    price: 24_000,
    values: { fabric: "Adire", made_in_nigeria: true },
    variants: [
      { sku: "ADK-M", options: { size: "M", colour: "Indigo" }, qty: 4, reorder: 2 },
      { sku: "ADK-L", options: { size: "L", colour: "Indigo" }, qty: 8, reorder: 2 },
      { sku: "ADK-XL", options: { size: "XL", colour: "Indigo" }, price: 26_000, qty: 3, reorder: 2 },
      { sku: "ADK-XXL", options: { size: "XXL", colour: "Indigo" }, price: 26_000, qty: 0, reorder: 2 },
    ],
  },
  {
    name: "Linen Senator Shirt",
    category: "clothing",
    type: "apparel",
    price: 15_000,
    values: { fabric: "Linen", made_in_nigeria: true },
    variants: [
      ...sizes("LSS-WHT", ["M", "L", "XL"], { colour: "White" }, [12, 15, 9], 4),
      ...sizes("LSS-EMR", ["M", "L", "XL"], { colour: "Emerald" }, [7, 3, 6], 4),
    ],
  },
  {
    name: "Leather Oxford Shoe",
    description: "Hand-stitched full-grain leather Oxfords, made in Aba.",
    category: "footwear",
    type: "footwear",
    price: 32_000,
    values: { upper_material: "Full-grain cowhide" },
    variants: ["40", "41", "42", "43", "44", "45"].map((s, i) => ({
      sku: `LOX-BRN-${s}`,
      options: { shoe_size: s, colour: "Brown" },
      qty: [3, 5, 8, 6, 2, 1][i],
      reorder: 2,
    })),
  },
  {
    name: "Canvas Sneaker",
    category: "footwear",
    type: "footwear",
    price: 12_500,
    values: { upper_material: "Cotton canvas" },
    variants: ["39", "40", "41", "42", "43"].map((s, i) => ({
      sku: `CSN-WHT-${s}`,
      options: { shoe_size: s, colour: "White" },
      qty: [10, 14, 18, 11, 6][i],
      reorder: 4,
    })),
  },
  {
    name: "Palm Slippers",
    category: "footwear",
    type: "footwear",
    price: 6_500,
    values: { upper_material: "Woven leather" },
    variants: [{ sku: "PSL-TAN", qty: 25, reorder: 8 }],
  },
  {
    name: "Classic Chronograph",
    description: "Stainless steel case with a three-dial chronograph.",
    category: "watches-and-jewellery",
    type: "watch",
    price: 85_000,
    values: { movement: "Quartz", case_diameter: 42, water_resistant: true },
    variants: [
      { sku: "CHR-LTH", options: { strap: "Leather" }, qty: 4, reorder: 2 },
      { sku: "CHR-STL", options: { strap: "Steel" }, price: 95_000, qty: 1, reorder: 2 },
    ],
  },
  {
    name: "Digital Sports Watch",
    category: "watches-and-jewellery",
    type: "watch",
    price: 22_000,
    values: { movement: "Digital", case_diameter: 44, water_resistant: true },
    variants: [{ sku: "DSW-BLK", qty: 9, reorder: 3 }],
  },
  {
    name: "Coral Bead Necklace",
    description: "Traditional red coral beads on a brass clasp.",
    category: "watches-and-jewellery",
    type: "jewellery",
    price: 45_000,
    values: { length: 46, stone: "Red coral" },
    variants: [{ sku: "CBN-46", qty: 3, reorder: 3 }],
  },
  {
    name: "Twisted Bangle",
    category: "watches-and-jewellery",
    type: "jewellery",
    price: 9_500,
    values: { length: 20 },
    variants: [
      { sku: "TBG-SLV", options: { metal: "Sterling silver" }, price: 14_000, qty: 6, reorder: 2 },
      { sku: "TBG-GLD", options: { metal: "Gold-plated" }, qty: 11, reorder: 3 },
      { sku: "TBG-BRS", options: { metal: "Brass" }, price: 6_000, qty: 0, reorder: 3 },
    ],
  },
  {
    name: "Leather Tote",
    description: "Structured tote with an inner zip pocket.",
    category: "bags",
    type: "bag",
    price: 38_000,
    values: { capacity: 14, material: "Vegetable-tanned leather" },
    variants: [
      { sku: "LTT-BLK", options: { colour: "Black" }, qty: 5, reorder: 2 },
      { sku: "LTT-BRN", options: { colour: "Brown" }, qty: 2, reorder: 2 },
    ],
  },
  {
    name: "Everyday Backpack",
    category: "bags",
    type: "bag",
    price: 16_500,
    values: { capacity: 22, material: "Recycled polyester" },
    variants: [
      { sku: "EBP-NVY", options: { colour: "Navy" }, qty: 13, reorder: 4 },
      { sku: "EBP-BLK", options: { colour: "Black" }, qty: 17, reorder: 4 },
      { sku: "EBP-RED", options: { colour: "Red" }, qty: 4, reorder: 4 },
    ],
  },
  {
    name: "Stainless Steel Pot Set",
    description: "Three pots with lids: 2 L, 3.5 L and 5 L.",
    category: "home-and-kitchen",
    type: "kitchenware",
    price: 54_000,
    values: { capacity: 10.5, material: "18/10 stainless steel", dishwasher_safe: true },
    variants: [{ sku: "SSP-3PC", qty: 6, reorder: 2 }],
  },
  {
    name: "Vacuum Flask",
    category: "home-and-kitchen",
    type: "kitchenware",
    price: 8_000,
    values: { capacity: 1.5, material: "Stainless steel", dishwasher_safe: false },
    variants: [{ sku: "VFL-15", qty: 2, reorder: 5 }],
  },
  {
    name: "Wooden Mortar and Pestle",
    category: "home-and-kitchen",
    type: "kitchenware",
    price: 7_500,
    values: { material: "Iroko wood" },
    variants: [{ sku: "WMP-LG", qty: 14, reorder: 3 }],
  },
];

async function main() {
  const categoryIds = new Map<string, string>();
  for (const c of categories) {
    const row = await db.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
    categoryIds.set(c.slug, row.id);
  }

  // type slug -> attribute code -> { id, inputType, options: value -> id }
  const typeIndex = new Map<string, { id: string; attrs: Map<string, { id: string; inputType: InputType; options: Map<string, string> }> }>();
  for (const t of types) {
    const type = await db.productType.upsert({
      where: { slug: t.slug },
      update: {},
      create: { slug: t.slug, name: t.name, description: t.description },
    });
    const attrs = new Map<string, { id: string; inputType: InputType; options: Map<string, string> }>();
    for (const [position, a] of t.attributes.entries()) {
      const attr = await db.attributeDefinition.upsert({
        where: { productTypeId_code: { productTypeId: type.id, code: a.code } },
        update: {},
        create: {
          productTypeId: type.id,
          code: a.code,
          name: a.name,
          inputType: a.inputType,
          unit: a.unit ?? null,
          isRequired: a.isRequired ?? false,
          allowsVariants: a.allowsVariants ?? false,
          position,
        },
      });
      const options = new Map<string, string>();
      for (const [i, value] of (a.options ?? []).entries()) {
        const option = await db.attributeOption.upsert({
          where: { attributeId_value: { attributeId: attr.id, value } },
          update: {},
          create: { attributeId: attr.id, value, position: i },
        });
        options.set(value, option.id);
      }
      attrs.set(a.code, { id: attr.id, inputType: attr.inputType as InputType, options });
    }
    typeIndex.set(t.slug, { id: type.id, attrs });
  }

  let created = 0;
  for (const p of products) {
    const existing = await db.productVariant.count({ where: { sku: { in: p.variants.map((v) => v.sku) } } });
    if (existing > 0) continue;

    const type = typeIndex.get(p.type)!;
    const attr = (code: string) => {
      const a = type.attrs.get(code);
      if (!a) throw new Error(`Unknown attribute ${code} on type ${p.type}`);
      return a;
    };
    const option = (code: string, value: string) => {
      const id = attr(code).options.get(value);
      if (!id) throw new Error(`Unknown option ${value} for ${code}`);
      return id;
    };

    const values = Object.entries(p.values ?? {}).map(([code, value]) => {
      const a = attr(code);
      return {
        attributeId: a.id,
        textValue: a.inputType === "TEXT" ? String(value) : null,
        numberValue: a.inputType === "NUMBER" ? Number(value) : null,
        booleanValue: a.inputType === "BOOLEAN" ? Boolean(value) : null,
        optionId: a.inputType === "SELECT" ? option(code, String(value)) : null,
      };
    });

    await db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: p.name,
          description: p.description ?? null,
          categoryId: categoryIds.get(p.category)!,
          productTypeId: type.id,
          priceKobo: p.price * 100,
          attributeValues: { create: values },
        },
      });
      for (const v of p.variants) {
        const opts = Object.entries(v.options ?? {}).map(([code, value]) => ({
          attributeId: attr(code).id,
          optionId: option(code, value),
        }));
        const optionKey = [...opts]
          .sort((a, b) => (a.attributeId < b.attributeId ? -1 : a.attributeId > b.attributeId ? 1 : 0))
          .map((o) => `${o.attributeId}:${o.optionId}`)
          .join("|");
        await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: v.sku,
            optionKey,
            priceOverrideKobo: v.price ? v.price * 100 : null,
            quantityOnHand: v.qty,
            reorderLevel: v.reorder,
            optionValues: { create: opts },
          },
        });
      }
    });
    created += 1;
  }

  console.log(`Seed complete: ${categories.length} categories, ${types.length} product types, ${created} new products.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
