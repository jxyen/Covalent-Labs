# Products CRUD + live storefront — design spec

**Date:** 2026-06-26
**Feature:** Products (admin) — one of the 7 admin features
**Terminal/migration number:** `0006`
**Branch base:** `main`

## Goal

Build the admin Products management UI **and** make the public storefront read
the catalog from the database, so that editing a product in `/admin/products`
changes what shoppers see on the live site. Today there are two disconnected
copies of the catalog: a hardcoded `PRODUCTS` array in `src/lib/products.ts`
(what the site renders) and a seeded copy in the `products` / `product_sizes`
tables (what admin will edit). This feature makes the **database the single
source of truth** for the catalog.

## Decisions (settled in brainstorming)

- **Storefront reads from DB** (owner override of the foundation's "don't touch
  storefront" guardrail — that rule existed to keep parallel feature terminals
  from colliding, and none of them touch the storefront, so conflict risk is low).
- **Images:** upload to Supabase Storage; existing products keep their current
  repo paths (`/products/...png`) until replaced. Single `image` per product
  (the DB has one `image` column; the repo's extra `cutout`/`hires` variants are
  out of scope and remain referenced as static files where used).
- **Delete:** soft-delete only — `active` flag hides a product from the public
  catalog without removing it. No hard delete of products in v1.
- **Static content stays static:** `PRODUCT_DETAILS` (long-form copy),
  `ACCESSORIES`, `VOLUME_TIERS`, `FREE_SHIP_THRESHOLD`, `CATEGORY_META`, and all
  pure helper functions remain code in `src/lib/products.ts`. Only the editable
  catalog (the `PRODUCTS` array) moves to the DB.

## Environment facts (verified)

- Next.js **16.2.9**, Cache Components **disabled** → use `unstable_cache` +
  `revalidateTag`, **not** the `'use cache'` directive.
- `@/lib/supabase/server` `createClient()` reads cookies → **cannot** be called
  inside `unstable_cache`. Public catalog reads use a **cookieless anon client**.
- RLS today: only `is_staff()` may `SELECT` products/sizes → the anon public site
  cannot read them yet. A public-read policy is required.
- Catalog is already seeded via `npm run db:seed` (`scripts/seed-products.ts`),
  which imports `PRODUCTS` from `src/lib/products.ts`.

---

## Architecture

```
        ┌─────────────── WRITE (admin) ───────────────┐
        │  /admin/products → actions.ts (requireStaff) │
        │  cookie server client (RLS = staff)          │
        │  mutate products / product_sizes + Storage   │
        │  → revalidateTag('catalog')                  │
        └──────────────────────┬───────────────────────┘
                               ▼
                    [ products + product_sizes ]  ← Supabase
                       ▲                    ▲
   READ (public)       │                    │   READ (admin list/edit)
   cookieless anon ────┘                    └──── cookie server client
   unstable_cache(tag:'catalog')                  (uncached, sees inactive)
   mapped → Product[]  → storefront pages
```

### 1. Database migration — `supabase/migrations/0006_products_public_and_storage.sql`

- **Public read RLS**
  - `products`: policy allowing `anon` + `authenticated` `SELECT` **where
    `active = true`**. (Staff keep full read via existing `is_staff()` policy.)
  - `product_sizes`: policy allowing `anon` + `authenticated` `SELECT`. Sizes of
    inactive products are unreachable in practice because the product is hidden.
  - `GRANT SELECT ON products, product_sizes TO anon;`
- **`compare_at numeric(10,2)` column** on `products` (nullable) — preserves the
  bundle "compare at" savings (today the optional `compareAt` on blend products)
  so it stays editable after the move to DB.
- **Storage bucket** `product-images` (public read) + storage RLS policies on
  `storage.objects` allowing `authenticated` users to `INSERT`/`UPDATE`/`SELECT`
  objects in that bucket. Uploads run in a server action using the **authenticated
  cookie client** — never the service role in a request path.
- Must include `GRANT`s per the foundation rule (`README.md` "Rules of the road").

### 2. Seed fixture refactor

- Move the raw seed data array out of `src/lib/products.ts` into
  `scripts/seed-data.ts` (keeps fixture data out of the app bundle), exporting the
  same shape. `scripts/seed-products.ts` imports it from there and also writes the
  new `compare_at` column.
- After initial seed, the DB is authoritative; the fixture is only for fresh-DB
  bootstrap (`npm run db:seed` after `npm run db:reset`).

### 3. Catalog read layer — `src/lib/catalog/`

- `client.ts` — a **cookieless** anon Supabase client (plain
  `@supabase/supabase-js` `createClient` with the anon key, no session) safe to
  call inside `unstable_cache`.
- `queries.ts` — `getCatalog()` returns `Product[]`; queries `products` (active
  only, for public) joined with `product_sizes`, mapped to the existing `Product`
  type (see mapping below). Wrapped in
  `unstable_cache(fn, ['catalog'], { tags: ['catalog'], revalidate: 3600 })`.
  Derived helpers `getFeatured()`, `getBestsellers()`, `getProductBySlug(slug)`,
  `getRelated(product, n)`, `categoryCount(list, cat)` operate on the fetched
  list (pure, given the list) so pages compute them without re-querying.
- **Mapping DB row → `Product`:** copy fields map 1:1
  (`code,name,sub,category,image,mechanism,tagline,purity,rating,reviews,
  bestseller,featured,blurb`); `compare_at` → `compareAt`; `product_sizes` →
  `sizes: { mg, price }[]` ordered by price ascending. `category` text is
  validated/cast to the `Category` union; rows with an unknown category are kept
  but logged.

### 4. Storefront refactor (the riskiest part — enumerated)

`src/lib/products.ts`:
- Remove `PRODUCTS`, and the module-level derived `FEATURED` / `BESTSELLERS`
  consts (they can no longer be computed at import time). Keep all types, pure
  helpers, and static content. `productBySlug` / `relatedProducts` /
  `categoryCount` are changed to take an explicit product list argument (or are
  superseded by the `src/lib/catalog` equivalents).

Pages/components (all reads become server-driven; client components receive
products via props):

| File | Today | Change |
|---|---|---|
| `src/app/page.tsx` | server, imports `BESTSELLERS`, `PRODUCTS` | `async`; `await getCatalog()`, derive bestsellers + the Retatrutide feature, pass down as props |
| `src/components/category-tabs.tsx` | **client**, imports `PRODUCTS` | accept `products: Product[]` prop; parent passes catalog |
| `src/app/catalog/page.tsx` | **client**, imports `PRODUCTS` | split: new server `page.tsx` fetches catalog → renders client `CatalogBrowser` (existing filter/sort logic) with `products` prop |
| `src/app/product/[slug]/page.tsx` | server, SSG via `generateStaticParams` over `PRODUCTS` | `async` fetch via `getProductBySlug`; drop static generation (or make it DB-backed) so new/edited products appear without a rebuild; relies on `revalidateTag('catalog')` |
| `product-card.tsx`, `feature-card.tsx`, `branded-vial.tsx`, `product-detail-view.tsx` | already take `Product` via props | no change beyond import hygiene |

### 5. Admin UI — `src/app/admin/products/`

- `page.tsx` (replace stub) — server component, `requireStaff()`; lists **all**
  products (active + inactive) via the cookie client with size count, category,
  status, price range. Row actions: **Edit**, **Deactivate/Reactivate**. Header
  action: **New product**.
- `new/page.tsx` + `[id]/edit/page.tsx` — server components rendering the shared
  client `product-form.tsx`. (Dedicated routes, not modals — simpler, server-
  rendered.)
- `product-form.tsx` (client) — fields: `name, code, sub, category` (dropdown of
  the 5 known categories), `mechanism, tagline, purity, blurb, rating, reviews,
  bestseller, featured, compare_at, active`, plus an **image upload** control and
  a **repeatable sizes editor** (rows of `mg`, `price`, `sku`).
- `actions.ts` (feature-local, **not** the shared `src/app/admin/actions.ts`) —
  server actions, each `requireStaff()` first, validated with zod, then
  `revalidateTag('catalog')`:
  - `createProduct(input)` — insert product + ≥1 size.
  - `updateProduct(id, input)` — update product fields + upsert/delete sizes.
  - `setProductActive(id, active)` — soft-delete toggle.
  - `uploadProductImage(formData)` — upload to Storage `product-images/{code}/…`
    via the authenticated cookie client, return the public URL.
  - `deleteSize(sizeId)` — guarded (see rules).

### 6. Field / data rules

- **Category:** constrained to the 5 known categories via dropdown; validated
  server-side against the allowed set.
- **SKU:** auto-suggested as `${code}-${mg normalized}` on create, editable,
  validated **unique** (`product_sizes.sku` is unique). Editing a SKU is safe —
  inventory references `size_id`, not `sku`.
- **Sizes:** a product must keep **≥ 1 size**. Deleting a size is blocked if it is
  the last remaining size. (Deleting a size cascades to its `inventory` row via
  the existing FK; `order_items` will reference `size_id` once Orders is built —
  noted as a future guard, not enforced in v1 since orders don't exist yet.)
- **Validation (zod):** `name`, `code` required; `code` unique; `price > 0`;
  at least one size; `sku` unique; `rating` 0–5; `reviews` ≥ 0.

### 7. Error handling

- Server actions return a typed result (`{ ok: true } | { ok: false, error }`);
  the form surfaces field/form errors inline. Unique-constraint violations
  (duplicate `code`/`sku`) are caught and mapped to friendly messages.
- Image upload failures don't block saving text fields (upload is a separate
  action that sets the image URL into the form before submit).

### 8. Testing (Vitest, `tests/`, service-role client per `tests/setup.ts`)

- **Catalog read layer:** seeded DB → `getCatalog()` returns active products
  mapped to `Product` shape; inactive products excluded from public read;
  `compare_at` maps to `compareAt`; sizes ordered correctly.
- **RLS:** anon client can read active products and cannot read inactive ones;
  anon cannot write.
- **Admin data-access / actions:** create product with sizes; update fields +
  sizes; soft-delete toggles `active` and removes from public read; SKU/code
  uniqueness enforced; last-size deletion blocked.
- **Mapping:** unknown category handling; price-range/size-count derivations.

## Out of scope (v1)

- Editing long-form `PRODUCT_DETAILS`, accessories, volume tiers (stay static).
- Managing multiple image variants (cutout/hires) — single `image` field only.
- Hard delete of products.
- Inventory/stock fields (owned by the Inventory terminal).
- Reordering categories or adding new category types.

## Coordination notes (parallel terminals)

- Migration number **0006** is reserved for this feature (Inventory 0007, Staff
  0008). Includes GRANTs.
- Server actions live in `src/app/admin/products/actions.ts`, not the shared
  `actions.ts`.
- This feature **does** touch the storefront (`src/lib/products.ts`, the 3 pages,
  `category-tabs`), which the other terminals do not — low collision risk.
- Run `npm run db:types` after the migration; expect to regenerate again after
  merging `main`.

## Implementation phasing

1. Migration 0006 (RLS, `compare_at`, Storage) + `db:types`.
2. Seed fixture refactor + verify `db:seed`.
3. Catalog read layer (`src/lib/catalog/`) + tests.
4. Storefront refactor to consume the read layer (prove DB drives the site).
5. Admin CRUD UI + actions + image upload + tests (prove editing works).
6. End-to-end check: edit in admin → `revalidateTag` → change visible on site.
