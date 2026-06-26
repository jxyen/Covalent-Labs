# Kairo Labs Admin — Foundation Design

**Date:** 2026-06-26
**Status:** Approved (design); pending implementation plan
**Author:** Jackson Montague + Claude

## Purpose

Build the shared foundation for a full admin platform on top of the existing
Kairo Labs Next.js storefront, so that multiple developers ("terminals") can
then build individual features in parallel without schema or convention
collisions.

The admin platform is the **system of record**: orders come in manually today
(Venmo / CashApp / Zelle) and a card / Apple Pay / Google Pay processor will be
added later. No external commerce platform is the source of truth; we own the
data model and design it so a payment processor can plug in later without
re-architecting.

## Current state (baseline)

- Next.js 16 (App Router, React 19, Tailwind v4) storefront, **front-end only**.
- Products are a static TypeScript array in `src/lib/products.ts`.
- Cart is client-side React context (`src/components/cart-context.tsx`).
- **No** database, auth, orders, payments, or backend of any kind.
- A separate developer is **actively** working on the public storefront.

## Scope

### This build delivers

- Supabase project wiring + schema as source-controlled migrations.
- Secure **staff** auth with `owner` / `staff` roles, enforced server-side.
- Protected `/admin` route group: auth-guarded layout, sidebar nav, topbar.
- Shared, typed data-access layer (Supabase SSR clients + generated types +
  data-access functions).
- Real product catalog seeded into the DB from `src/lib/products.ts`.
- A **stub section page for every feature**: Dashboard, Orders, Products,
  Inventory, Affiliates, Shipping, Staff. Each is real, wired, role-gated, and
  pulls a live count from the DB to prove the data layer works end-to-end.
- One markdown **task brief per feature** (owned tables, types, routes,
  definition of done) so each terminal has a self-contained scope.

### This build does NOT do

- Build out feature logic (that is each terminal's job).
- Touch the live public storefront. The public site keeps reading the static
  `products.ts`. We seed the DB from it. Repointing the storefront at the DB is
  a later, coordinated step with the other developer.
- Integrate a real payment processor (manual payment methods only for now;
  schema is processor-ready).
- Affiliate login / portal (schema exists now; the feature is a later phase).

## Architecture

### Database schema (Supabase Postgres)

The shared data model all features build against.

- **`staff`** — profile row linked 1:1 to a Supabase `auth.users` id.
  Fields: `id` (uuid, FK auth.users), `email`, `full_name`, `role`
  (enum `owner` | `staff`), `active` (bool), `created_at`.
  Owner sees revenue and everything; staff is scoped away from revenue.

- **`products`** — catalog migrated out of the static array.
  Fields mirror the current `Product` interface: `id` (uuid), `code` (unique),
  `name`, `sub`, `category`, `image`, `mechanism`, `tagline`, `purity`,
  `rating`, `reviews`, `bestseller`, `featured`, `blurb`, `active` (bool),
  `created_at`, `updated_at`.

- **`product_sizes`** — each size is a sellable SKU; inventory and order line
  items reference this, not `products`.
  Fields: `id` (uuid), `product_id` (FK), `mg` (label, e.g. "5 mg"), `price`
  (numeric), `sku` (unique), `created_at`.

- **`inventory`** — current stock per SKU.
  Fields: `size_id` (FK product_sizes, unique), `quantity_on_hand` (int),
  `reorder_threshold` (int), `updated_at`.

- **`inventory_movements`** — append-only ledger so stock is auditable.
  Fields: `id` (uuid), `size_id` (FK), `delta` (int, +/-),
  `reason` (enum `restock` | `sale` | `adjustment`), `order_id` (FK, nullable),
  `created_by` (FK staff), `created_at`.

- **`orders`** — one per transaction.
  Fields: `id` (uuid), `order_number` (human-friendly, unique),
  `customer_name`, `customer_email`, `customer_phone`,
  `shipping_address` (jsonb), `status` (enum `pending` | `paid` | `fulfilled` |
  `shipped` | `delivered` | `cancelled` | `refunded`),
  `payment_method` (enum `venmo` | `cashapp` | `zelle` | `card` | `applepay` |
  `googlepay` | `crypto` | `other`),
  `payment_status` (enum `unpaid` | `paid` | `refunded`),
  `subtotal`, `shipping_cost`, `discount_total`, `total` (numeric),
  `affiliate_id` (FK affiliates, nullable), `notes`, `created_by` (FK staff),
  `created_at`, `updated_at`.

- **`order_items`** — line items with snapshotted values so history stays
  accurate if a product later changes.
  Fields: `id` (uuid), `order_id` (FK), `size_id` (FK product_sizes),
  `product_name` (snapshot), `mg` (snapshot), `unit_price` (snapshot),
  `quantity` (int), `line_total` (numeric).

- **`payments`** — supports manual-now / processor-later and partial payments.
  Fields: `id` (uuid), `order_id` (FK), `method` (same enum as
  `orders.payment_method`), `amount` (numeric),
  `status` (enum `pending` | `confirmed` | `refunded`), `reference` (text,
  e.g. Venmo note / processor id), `created_at`.

- **`affiliates`** — exists now so revenue attribution works the day the
  affiliate feature is built.
  Fields: `id` (uuid), `name`, `email`, `code` (unique referral code),
  `commission_rate` (numeric), `status` (enum `active` | `inactive`),
  `created_at`. (`affiliate_payouts` is a later addition.)

- **`shipments`** — fulfillment per order.
  Fields: `id` (uuid), `order_id` (FK), `carrier`, `service`,
  `tracking_number`, `label_url` (Supabase Storage), `cost` (numeric),
  `status`, `created_at`.

- **Revenue / metrics** — no table. The dashboard aggregates from `orders`.

### Auth & security

- Supabase Auth, email + password.
- Enforced **server-side** in Next.js middleware and the `/admin` layout —
  unauthenticated requests redirect to `/admin/login`. Client checks are
  convenience only; the server is the gate.
- **Row-Level Security on every table.** Only authenticated staff can read or
  write. Revenue-sensitive reads (and the Dashboard) are gated to `owner`.
- Service-role key is **server-only**, never shipped to the browser.
- First owner is created via a seed / invite step.
- 2FA is a later, easy add (out of scope here).

### Admin app shell

- New route group `src/app/admin/` with its own auth-guarded layout
  (separate from the public storefront layout).
- `src/app/admin/login/page.tsx` — login form.
- Sidebar sections → stub pages: Dashboard, Orders, Products, Inventory,
  Affiliates, Shipping, Staff. Topbar with current user + sign out.
- Each stub page is real, wired into nav + auth, role-gated where relevant, and
  renders its header, a placeholder, and a **live count from the DB** to prove
  the data layer end-to-end.

### Shared data layer

- `src/lib/supabase/` — server client, browser client, and middleware client
  using the Supabase SSR pattern for Next.js 16.
- Generated TypeScript types from the schema (`supabase gen types`).
- Typed data-access functions that features import.
- Migrations in `supabase/migrations/` under source control — the canonical
  schema. A seed migration loads the real products from `products.ts`.

### Parallelization guardrail

One short markdown brief per feature in `docs/` covering: owned tables,
types/interfaces, routes, and definition of done. Lets each terminal pick up a
self-contained scope with no schema collisions.

## Prerequisites / open items for implementation

- **Supabase project + env keys** required before migrations run. Provision via
  the Vercel Marketplace Supabase integration (auto-sets env vars) or create a
  project manually. To be settled at the start of implementation.
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (server-only).

## Risks & considerations

- **Sensitive vertical + real customer PII / addresses.** Baseline: RLS on all
  tables, server-only secrets, no PII in logs.
- **Two temporary sources of truth** for products (static array for the live
  storefront, DB for admin) until the storefront is repointed. Deliberate, to
  avoid disrupting the other developer; tracked as a follow-up.
- **Payment processor uncertainty** in this vertical is a known business risk;
  the schema decouples us from any single processor.

## Testing approach

- Migrations apply cleanly from scratch; seed loads the real catalog.
- Auth guard: unauthenticated request to any `/admin/*` route redirects to
  login; authenticated staff reaches the shell.
- RLS: unauthenticated / unauthorized access to tables is denied; `staff`
  cannot read revenue-gated data.
- Data-layer functions are unit-tested where practical (TDD where it fits).
- Each stub page renders and shows its live DB count.

## Out of scope (future phases)

- Feature build-outs (Orders, Products CRUD, Inventory, Affiliates, Shipping,
  Revenue dashboard logic).
- Affiliate login / portal.
- Real payment-processor integration.
- Repointing the public storefront at the DB.
- 2FA.
