# People's Shop Inventory

Catalogue and stock management for People's Shop: products with typed attributes, per-SKU
variants (e.g. size × colour), prices in naira, and low-stock tracking.

Built with Next.js 16 (App Router, Cache Components), Prisma 7 on SQLite, Tailwind CSS 4 and Base UI.

## Features

- **Products**: search (name, SKU, size, colour…), filter by category, type and stock status,
  sort by any column, paginate. Shareable URLs.
- **Variants**: tick the attributes a product varies by (e.g. Size, Colour), pick the values you
  stock, and get one SKU per combination with suggested SKU codes, optional per-variant price,
  quantity and reorder level.
- **Low stock**: a SKU is low when quantity on hand ≤ its reorder level. Products show how many of
  their SKUs are low; the header links straight to the low-stock list.
- **Product types**: define the attributes each kind of product records (text, number with unit,
  yes/no, list of options) and which list attributes create variants. Edits that would break
  existing products (removing an option in use, changing an attribute's input type) are refused.
- **Categories** for browsing. Categories and types in use can't be deleted.
- Concurrent edits are detected: saving a record someone else changed asks you to reload.

## Setup

Requires Node 22.12+ (see `.nvmrc`) and Bun.

```bash
cp .env.example .env
bun install
bun run db:deploy   # create prisma/dev.db
bun run db:seed     # demo catalogue (safe to run again)
bun run dev         # http://localhost:3000
```

`bun run db:reset` wipes the database and re-seeds it.

## Checks

```bash
bun run lint
bun run typecheck
bun run test        # unit + integration (uses a throwaway prisma/test.db)
bun run test:e2e    # Playwright against a production build on :3100 with prisma/e2e.db
```

First time only for e2e: `npx playwright install chromium`.

## Layout

| Path | What |
| --- | --- |
| `prisma/schema.prisma` | Data model (money in kobo, stock status derived) |
| `prisma/seed.ts` | Demo data |
| `lib/services/` | Reads and mutations with validation (server only) |
| `app/actions/` | Server actions wrapping the services |
| `lib/types.ts` | Contracts shared by services, actions and UI |
| `lib/money.ts`, `lib/stock.ts`, `lib/format.ts` | Naira parsing/formatting, low-stock rule, dates |
| `app/products`, `app/categories`, `app/types` | Pages and client forms |
| `components/` | Shared UI |
