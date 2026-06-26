# Kairo Labs Admin Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared backend + auth + admin-shell foundation so multiple developers can build admin features in parallel against one agreed schema.

**Architecture:** Supabase (Postgres + Auth + Storage) is the system of record. A new `/admin` route group is protected server-side via Next.js `proxy.ts` (optimistic redirect) plus a Data Access Layer (`requireStaff` / `requireOwner`) that re-checks against the database. Every table has Row-Level Security gated to authenticated staff, with revenue-sensitive access gated to the `owner` role. Feature pages ship as wired, role-gated stubs that prove the data layer end-to-end.

**Tech Stack:** Next.js 16.2.9 (App Router, React 19), TypeScript, Tailwind v4, `@supabase/ssr` + `@supabase/supabase-js`, Supabase CLI, Vitest (tests), `tsx` (scripts/seed).

## Global Constraints

- **Next.js 16 is modified** — middleware is renamed to **`proxy.ts`** (default/named export `proxy`, Node.js runtime). Never create `middleware.ts`. Verify any Next API against `node_modules/next/dist/docs/` before use.
- **App lives under `src/`** — so `proxy.ts` goes at `src/proxy.ts`; the app router is `src/app`; import alias is `@/*` → `./src/*`.
- **Do NOT modify the public storefront** (`src/app/page.tsx`, `src/app/catalog/`, `src/components/*`, `src/lib/products.ts`). Products are *seeded from* `products.ts` into the DB; the static file stays untouched.
- **Service-role key is server-only.** Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` may reach the browser. Never import `src/lib/supabase/admin.ts` from a Client Component.
- **RLS on every table.** No table is left with RLS disabled. Anonymous access is denied everywhere.
- **Explicit GRANTs on every new table** (this Supabase config does not auto-expose tables). After the RLS policies in each migration, grant: `grant all on public.<table> to service_role;` and `grant select, insert, update, delete on public.<table> to authenticated;`. Do **not** grant admin tables to `anon`. Follow the pattern established in `0001_staff.sql`.
- **Test bootstrap polyfill:** `tests/setup.ts` polyfills `WebSocket` from the `ws` devDependency (Node 20 has no global `WebSocket`, which `supabase-js` needs). Leave it in place.
- **Roles:** `owner` (sees everything incl. revenue) and `staff` (no revenue). Enum value strings exactly: `owner`, `staff`.
- **Money columns** are `numeric(10,2)`. **IDs** are `uuid default gen_random_uuid()`. **Timestamps** are `timestamptz default now()`.
- **Commit after every task** with a `feat:`/`chore:`/`docs:` message; end each commit message with the Co-Authored-By trailer used in this repo.

---

## Prerequisite (handoff decision — do before Task 1)

Pick the Supabase target. Both use the same migrations; only the connection differs.

- **Local (recommended for dev):** install Docker Desktop, then `supabase start` runs Postgres + Auth + Storage locally. Keys are printed by the CLI.
- **Cloud:** create a project (Vercel Marketplace Supabase integration auto-sets env vars, or supabase.com). Then `supabase link` + `supabase db push`.

`.env.local` must end up with: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## Task 1: Dependencies, Supabase CLI init, env scaffolding

**Files:**
- Modify: `package.json` (deps + scripts)
- Create: `supabase/config.toml` (via CLI)
- Create: `.env.local`, `.env.example`
- Modify: `.gitignore` (ensure `.env.local` ignored)
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

**Interfaces:**
- Produces: a running Supabase instance reachable via env vars; `npm test` runs Vitest with `.env.local` loaded; `npm run db:reset` applies all migrations + seed.

- [ ] **Step 1: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D supabase vitest dotenv tsx
```

- [ ] **Step 2: Initialize Supabase**

```bash
npx supabase init
```
Expected: creates `supabase/config.toml` and `supabase/.gitignore`. Answer "N" if asked to generate VS Code settings.

- [ ] **Step 3: Start the database (local path) or link (cloud path)**

Local:
```bash
npx supabase start
```
Expected: prints `API URL`, `anon key`, `service_role key`. (Cloud path instead: `npx supabase link --project-ref <ref>`.)

- [ ] **Step 4: Create `.env.local`** with the values from Step 3 (local example shown; cloud uses your project's values):

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start>
```

- [ ] **Step 5: Create `.env.example`** (committed, no secrets):

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 6: Ensure `.gitignore` ignores env + supabase temp**

Confirm `.env*` (except `.env.example`) and `supabase/.temp` are ignored. If `.env*` not present, add:
```
.env.local
```

- [ ] **Step 7: Add scripts to `package.json`**

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "db:reset": "supabase db reset",
  "db:types": "supabase gen types typescript --local > src/lib/supabase/database.types.ts",
  "db:seed": "tsx scripts/seed-products.ts"
}
```

- [ ] **Step 8: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
  },
})
```

- [ ] **Step 9: Create `tests/setup.ts`** (loads `.env.local` for tests)

```ts
import { config } from 'dotenv'
config({ path: '.env.local' })
```

- [ ] **Step 10: Verify Vitest runs (no tests yet is OK once a test exists). Smoke-test the toolchain:**

Run: `npx supabase status`
Expected: shows `API URL`, `DB URL` running (local) or linked project (cloud).

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json supabase/config.toml .env.example .gitignore vitest.config.ts tests/setup.ts
git commit -m "chore: scaffold supabase, vitest, and env for admin foundation"
```

---

## Task 2: Auth / staff schema + RLS helpers

**Files:**
- Create: `supabase/migrations/0001_staff.sql`
- Create: `tests/db/staff.test.ts`

**Interfaces:**
- Produces: table `public.staff(id uuid pk → auth.users, email text, full_name text, role staff_role, active bool, created_at timestamptz)`; enum `staff_role` = `('owner','staff')`; SQL functions `public.is_staff() → bool` and `public.is_owner() → bool` (both `security definer`, used by later tasks' RLS policies); a trigger that auto-creates a `staff` row when an `auth.users` row is inserted (default role `staff`, inactive until promoted).

- [ ] **Step 1: Write the failing test** `tests/db/staff.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!

describe('staff table', () => {
  it('exists and is readable by the service role', async () => {
    const admin = createClient(url, service, { auth: { persistSession: false } })
    const { error } = await admin.from('staff').select('id').limit(1)
    expect(error).toBeNull()
  })

  it('denies anonymous reads (RLS on)', async () => {
    const anonClient = createClient(url, anon, { auth: { persistSession: false } })
    const { data } = await anonClient.from('staff').select('id')
    expect(data ?? []).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/db/staff.test.ts`
Expected: FAIL — relation "staff" does not exist.

- [ ] **Step 3: Write the migration** `supabase/migrations/0001_staff.sql`

```sql
create type public.staff_role as enum ('owner', 'staff');

create table public.staff (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.staff_role not null default 'staff',
  active boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.staff enable row level security;

-- security-definer helpers bypass RLS, so policies referencing them do not recurse
create or replace function public.is_staff() returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.staff where id = auth.uid() and active);
$$;

create or replace function public.is_owner() returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.staff where id = auth.uid() and active and role = 'owner');
$$;

-- a staff member can read their own row; owners can read/manage all
create policy "staff read self" on public.staff
  for select using (id = auth.uid() or public.is_owner());
create policy "owner manage staff" on public.staff
  for all using (public.is_owner()) with check (public.is_owner());

-- auto-create a staff profile row on new auth user (inactive, role=staff)
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.staff (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 4: Apply the migration**

Run: `npm run db:reset`
Expected: migration `0001_staff` applied with no errors.

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm test -- tests/db/staff.test.ts`
Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0001_staff.sql tests/db/staff.test.ts
git commit -m "feat: staff table, roles, RLS helpers, and new-user trigger"
```

---

## Task 3: Products + product_sizes schema

**Files:**
- Create: `supabase/migrations/0002_products.sql`
- Create: `tests/db/products.test.ts`

**Interfaces:**
- Consumes: `public.is_staff()`, `public.is_owner()` from Task 2.
- Produces: `public.products` (mirrors the `Product` interface fields) and `public.product_sizes(id, product_id, mg, price numeric(10,2), sku unique, created_at)`. `product_sizes.sku` is the SKU referenced by inventory + order items in later tasks. Category stored as `text` (not an enum) to stay flexible for the Products feature team.

- [ ] **Step 1: Write the failing test** `tests/db/products.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, service, { auth: { persistSession: false } })

describe('products schema', () => {
  it('can insert a product with a size', async () => {
    const { data: product, error: pErr } = await admin
      .from('products')
      .insert({ code: 'TEST-1', name: 'Test', sub: 's', category: 'Recovery & Repair' })
      .select().single()
    expect(pErr).toBeNull()
    const { error: sErr } = await admin
      .from('product_sizes')
      .insert({ product_id: product!.id, mg: '5 mg', price: 9.99, sku: 'TEST-1-5MG' })
    expect(sErr).toBeNull()
    await admin.from('products').delete().eq('code', 'TEST-1')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/db/products.test.ts`
Expected: FAIL — relation "products" does not exist.

- [ ] **Step 3: Write the migration** `supabase/migrations/0002_products.sql`

```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sub text,
  category text not null,
  image text,
  mechanism text,
  tagline text,
  purity text,
  rating numeric(2,1) default 0,
  reviews integer default 0,
  bestseller boolean not null default false,
  featured boolean not null default false,
  blurb text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_sizes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  mg text not null,
  price numeric(10,2) not null,
  sku text not null unique,
  created_at timestamptz not null default now()
);

create index on public.product_sizes (product_id);

alter table public.products enable row level security;
alter table public.product_sizes enable row level security;

create policy "staff read products" on public.products
  for select using (public.is_staff());
create policy "staff write products" on public.products
  for all using (public.is_staff()) with check (public.is_staff());

create policy "staff read sizes" on public.product_sizes
  for select using (public.is_staff());
create policy "staff write sizes" on public.product_sizes
  for all using (public.is_staff()) with check (public.is_staff());

grant all on public.products to service_role;
grant select, insert, update, delete on public.products to authenticated;
grant all on public.product_sizes to service_role;
grant select, insert, update, delete on public.product_sizes to authenticated;
```

- [ ] **Step 4: Apply + test**

Run: `npm run db:reset && npm test -- tests/db/products.test.ts`
Expected: migration applies; test PASSES.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_products.sql tests/db/products.test.ts
git commit -m "feat: products and product_sizes schema with RLS"
```

---

## Task 4: Inventory + movements schema

**Files:**
- Create: `supabase/migrations/0003_inventory.sql`
- Create: `tests/db/inventory.test.ts`

**Interfaces:**
- Consumes: `product_sizes` (Task 3), `is_staff()` (Task 2).
- Produces: `public.inventory(size_id uuid pk → product_sizes, quantity_on_hand int, reorder_threshold int, updated_at)` and `public.inventory_movements(id, size_id, delta int, reason inventory_reason, order_id uuid null, created_by uuid null, created_at)`; enum `inventory_reason` = `('restock','sale','adjustment')`.

- [ ] **Step 1: Write the failing test** `tests/db/inventory.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

describe('inventory schema', () => {
  it('tracks stock per size', async () => {
    const { data: p } = await admin.from('products')
      .insert({ code: 'INV-1', name: 'Inv', sub: 's', category: 'Recovery & Repair' }).select().single()
    const { data: size } = await admin.from('product_sizes')
      .insert({ product_id: p!.id, mg: '5 mg', price: 1, sku: 'INV-1-5MG' }).select().single()
    const { error } = await admin.from('inventory')
      .insert({ size_id: size!.id, quantity_on_hand: 10, reorder_threshold: 3 })
    expect(error).toBeNull()
    await admin.from('products').delete().eq('code', 'INV-1')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/db/inventory.test.ts`
Expected: FAIL — relation "inventory" does not exist.

- [ ] **Step 3: Write the migration** `supabase/migrations/0003_inventory.sql`

```sql
create type public.inventory_reason as enum ('restock', 'sale', 'adjustment');

create table public.inventory (
  size_id uuid primary key references public.product_sizes(id) on delete cascade,
  quantity_on_hand integer not null default 0,
  reorder_threshold integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  size_id uuid not null references public.product_sizes(id) on delete cascade,
  delta integer not null,
  reason public.inventory_reason not null,
  order_id uuid,
  created_by uuid references public.staff(id),
  created_at timestamptz not null default now()
);

create index on public.inventory_movements (size_id);

alter table public.inventory enable row level security;
alter table public.inventory_movements enable row level security;

create policy "staff all inventory" on public.inventory
  for all using (public.is_staff()) with check (public.is_staff());
create policy "staff all movements" on public.inventory_movements
  for all using (public.is_staff()) with check (public.is_staff());

grant all on public.inventory to service_role;
grant select, insert, update, delete on public.inventory to authenticated;
grant all on public.inventory_movements to service_role;
grant select, insert, update, delete on public.inventory_movements to authenticated;
```

- [ ] **Step 4: Apply + test**

Run: `npm run db:reset && npm test -- tests/db/inventory.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_inventory.sql tests/db/inventory.test.ts
git commit -m "feat: inventory and inventory_movements schema with RLS"
```

---

## Task 5: Orders + items + payments schema

**Files:**
- Create: `supabase/migrations/0004_orders.sql`
- Create: `tests/db/orders.test.ts`

**Interfaces:**
- Consumes: `product_sizes` (Task 3), `is_staff()`/`is_owner()` (Task 2). `affiliate_id` references a table created in Task 6 — so this migration adds the `affiliate_id uuid` column **without** the FK constraint, and Task 6 adds the FK. (Migrations run in order; the affiliates table does not exist yet here.)
- Produces: `public.orders`, `public.order_items`, `public.payments`; enums `order_status` = `('pending','paid','fulfilled','shipped','delivered','cancelled','refunded')`, `payment_method` = `('venmo','cashapp','zelle','card','applepay','googlepay','crypto','other')`, `payment_status` = `('unpaid','paid','refunded')`, `payment_record_status` = `('pending','confirmed','refunded')`.

- [ ] **Step 1: Write the failing test** `tests/db/orders.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

describe('orders schema', () => {
  it('creates an order with an item and a payment', async () => {
    const { data: order, error } = await admin.from('orders').insert({
      order_number: 'KL-TEST-1', customer_name: 'Jane',
      status: 'pending', payment_method: 'venmo', payment_status: 'unpaid',
      subtotal: 23.99, total: 23.99,
    }).select().single()
    expect(error).toBeNull()
    const { error: iErr } = await admin.from('order_items').insert({
      order_id: order!.id, product_name: 'BPC-157', mg: '5 mg',
      unit_price: 23.99, quantity: 1, line_total: 23.99,
    })
    expect(iErr).toBeNull()
    const { error: pErr } = await admin.from('payments').insert({
      order_id: order!.id, method: 'venmo', amount: 23.99, status: 'pending',
    })
    expect(pErr).toBeNull()
    await admin.from('orders').delete().eq('order_number', 'KL-TEST-1')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/db/orders.test.ts`
Expected: FAIL — relation "orders" does not exist.

- [ ] **Step 3: Write the migration** `supabase/migrations/0004_orders.sql`

```sql
create type public.order_status as enum
  ('pending','paid','fulfilled','shipped','delivered','cancelled','refunded');
create type public.payment_method as enum
  ('venmo','cashapp','zelle','card','applepay','googlepay','crypto','other');
create type public.payment_status as enum ('unpaid','paid','refunded');
create type public.payment_record_status as enum ('pending','confirmed','refunded');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  shipping_address jsonb,
  status public.order_status not null default 'pending',
  payment_method public.payment_method not null default 'other',
  payment_status public.payment_status not null default 'unpaid',
  subtotal numeric(10,2) not null default 0,
  shipping_cost numeric(10,2) not null default 0,
  discount_total numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  affiliate_id uuid, -- FK added in 0005 once affiliates exists
  notes text,
  created_by uuid references public.staff(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  size_id uuid references public.product_sizes(id),
  product_name text not null,
  mg text,
  unit_price numeric(10,2) not null,
  quantity integer not null default 1,
  line_total numeric(10,2) not null
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method public.payment_method not null,
  amount numeric(10,2) not null,
  status public.payment_record_status not null default 'pending',
  reference text,
  created_at timestamptz not null default now()
);

create index on public.order_items (order_id);
create index on public.payments (order_id);
create index on public.orders (created_at);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

-- All staff can manage orders/items/payments (revenue gating is enforced at the
-- dashboard/query layer, not here, since staff still process orders).
create policy "staff all orders" on public.orders
  for all using (public.is_staff()) with check (public.is_staff());
create policy "staff all order_items" on public.order_items
  for all using (public.is_staff()) with check (public.is_staff());
create policy "staff all payments" on public.payments
  for all using (public.is_staff()) with check (public.is_staff());

grant all on public.orders to service_role;
grant select, insert, update, delete on public.orders to authenticated;
grant all on public.order_items to service_role;
grant select, insert, update, delete on public.order_items to authenticated;
grant all on public.payments to service_role;
grant select, insert, update, delete on public.payments to authenticated;
```

- [ ] **Step 4: Apply + test**

Run: `npm run db:reset && npm test -- tests/db/orders.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_orders.sql tests/db/orders.test.ts
git commit -m "feat: orders, order_items, and payments schema with RLS"
```

---

## Task 6: Affiliates + shipments schema

**Files:**
- Create: `supabase/migrations/0005_affiliates_shipments.sql`
- Create: `tests/db/affiliates.test.ts`

**Interfaces:**
- Consumes: `orders` (Task 5), `is_staff()` (Task 2).
- Produces: `public.affiliates(id, name, email, code unique, commission_rate numeric(5,2), status affiliate_status, created_at)` with enum `affiliate_status` = `('active','inactive')`; adds FK `orders.affiliate_id → affiliates(id)`. `public.shipments(id, order_id, carrier, service, tracking_number, label_url, cost numeric(10,2), status, created_at)`.

- [ ] **Step 1: Write the failing test** `tests/db/affiliates.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

describe('affiliates + shipments', () => {
  it('links an order to an affiliate and a shipment', async () => {
    const { data: aff } = await admin.from('affiliates')
      .insert({ name: 'Ref', email: 'r@x.com', code: 'REF10', commission_rate: 10 })
      .select().single()
    const { data: order } = await admin.from('orders').insert({
      order_number: 'KL-AFF-1', customer_name: 'Jane', subtotal: 10, total: 10,
      affiliate_id: aff!.id,
    }).select().single()
    const { error } = await admin.from('shipments')
      .insert({ order_id: order!.id, carrier: 'USPS', tracking_number: '1Z', cost: 5 })
    expect(error).toBeNull()
    await admin.from('orders').delete().eq('order_number', 'KL-AFF-1')
    await admin.from('affiliates').delete().eq('code', 'REF10')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/db/affiliates.test.ts`
Expected: FAIL — relation "affiliates" does not exist.

- [ ] **Step 3: Write the migration** `supabase/migrations/0005_affiliates_shipments.sql`

```sql
create type public.affiliate_status as enum ('active', 'inactive');

create table public.affiliates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  code text not null unique,
  commission_rate numeric(5,2) not null default 0,
  status public.affiliate_status not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.orders
  add constraint orders_affiliate_id_fkey
  foreign key (affiliate_id) references public.affiliates(id) on delete set null;

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  carrier text,
  service text,
  tracking_number text,
  label_url text,
  cost numeric(10,2),
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index on public.shipments (order_id);

alter table public.affiliates enable row level security;
alter table public.shipments enable row level security;

create policy "staff all affiliates" on public.affiliates
  for all using (public.is_staff()) with check (public.is_staff());
create policy "staff all shipments" on public.shipments
  for all using (public.is_staff()) with check (public.is_staff());

grant all on public.affiliates to service_role;
grant select, insert, update, delete on public.affiliates to authenticated;
grant all on public.shipments to service_role;
grant select, insert, update, delete on public.shipments to authenticated;
```

- [ ] **Step 4: Apply + test**

Run: `npm run db:reset && npm test -- tests/db/affiliates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_affiliates_shipments.sql tests/db/affiliates.test.ts
git commit -m "feat: affiliates and shipments schema with RLS"
```

---

## Task 7: Generated types + Supabase client layer

**Files:**
- Create: `src/lib/supabase/database.types.ts` (generated)
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/admin.ts`
- Create: `tests/lib/clients.test.ts`

**Interfaces:**
- Produces:
  - `createClient(): Promise<SupabaseClient<Database>>` — **server** (RLS, user session) from `@/lib/supabase/server`.
  - `createClient(): SupabaseClient<Database>` — **browser** from `@/lib/supabase/client`.
  - `createAdminClient(): SupabaseClient<Database>` — **service role, server-only** from `@/lib/supabase/admin`.
  - `Database` type from `@/lib/supabase/database.types`.

- [ ] **Step 1: Generate types**

Run: `npm run db:types`
Expected: creates `src/lib/supabase/database.types.ts` exporting `Database`.

- [ ] **Step 2: Write the server client** `src/lib/supabase/server.ts`

```ts
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // called from a Server Component — safe to ignore; proxy refreshes the session
          }
        },
      },
    },
  )
}
```

- [ ] **Step 3: Write the browser client** `src/lib/supabase/client.ts`

```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 4: Write the admin client** `src/lib/supabase/admin.ts`

```ts
import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
```

- [ ] **Step 5: Write the test** `tests/lib/clients.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { createAdminClient } from '../../src/lib/supabase/admin'

describe('admin client', () => {
  it('connects with the service role and reads staff', async () => {
    const admin = createAdminClient()
    const { error } = await admin.from('staff').select('id').limit(1)
    expect(error).toBeNull()
  })
})
```

- [ ] **Step 6: Run the test**

Run: `npm test -- tests/lib/clients.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase/ tests/lib/clients.test.ts
git commit -m "feat: generated DB types and supabase server/browser/admin clients"
```

---

## Task 8: Product catalog seed script

**Files:**
- Create: `scripts/seed-products.ts`
- Create: `tests/db/seed.test.ts`

**Interfaces:**
- Consumes: `PRODUCTS` from `@/lib/products` (read-only), `createAdminClient` (Task 7).
- Produces: idempotent seed that upserts every product + its sizes (sku = `<CODE>-<MG without spaces, uppercased>`, e.g. `BPC-157-5MG`) and creates a zeroed `inventory` row per size. Re-runnable without duplicates.

- [ ] **Step 1: Write the failing test** `tests/db/seed.test.ts`

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { execSync } from 'node:child_process'
import { createAdminClient } from '../../src/lib/supabase/admin'
import { PRODUCTS } from '../../src/lib/products'

describe('product seed', () => {
  beforeAll(() => {
    execSync('npm run db:seed', { stdio: 'inherit' })
  })

  it('seeds every product from products.ts', async () => {
    const admin = createAdminClient()
    const { count } = await admin.from('products').select('*', { count: 'exact', head: true })
    expect(count).toBe(PRODUCTS.length)
  })

  it('creates an inventory row for every size', async () => {
    const admin = createAdminClient()
    const sizes = await admin.from('product_sizes').select('*', { count: 'exact', head: true })
    const inv = await admin.from('inventory').select('*', { count: 'exact', head: true })
    expect(inv.count).toBe(sizes.count)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/db/seed.test.ts`
Expected: FAIL — `npm run db:seed` errors (script missing).

- [ ] **Step 3: Write the seed script** `scripts/seed-products.ts`

```ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createAdminClient } from '../src/lib/supabase/admin'
import { PRODUCTS } from '../src/lib/products'

function skuFor(code: string, mg: string): string {
  return `${code}-${mg.replace(/\s+/g, '').toUpperCase()}`
}

async function main() {
  const admin = createAdminClient()

  for (const p of PRODUCTS) {
    const { data: product, error } = await admin
      .from('products')
      .upsert(
        {
          code: p.code, name: p.name, sub: p.sub, category: p.category,
          image: p.image, mechanism: p.mechanism, tagline: p.tagline,
          purity: p.purity, rating: p.rating, reviews: p.reviews,
          bestseller: p.bestseller, featured: p.featured, blurb: p.blurb,
        },
        { onConflict: 'code' },
      )
      .select()
      .single()
    if (error) throw error

    for (const s of p.sizes) {
      const sku = skuFor(p.code, s.mg)
      const { data: size, error: sErr } = await admin
        .from('product_sizes')
        .upsert(
          { product_id: product.id, mg: s.mg, price: s.price, sku },
          { onConflict: 'sku' },
        )
        .select()
        .single()
      if (sErr) throw sErr

      const { error: iErr } = await admin
        .from('inventory')
        .upsert({ size_id: size.id }, { onConflict: 'size_id' })
      if (iErr) throw iErr
    }
  }

  console.log(`Seeded ${PRODUCTS.length} products.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 4: Run the test**

Run: `npm test -- tests/db/seed.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify idempotency** — run the seed twice; count stays equal to `PRODUCTS.length`.

Run: `npm run db:seed && npm test -- tests/db/seed.test.ts`
Expected: PASS (no duplicates).

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-products.ts tests/db/seed.test.ts
git commit -m "feat: idempotent product catalog seed from products.ts"
```

---

## Task 9: proxy.ts — session refresh + admin route guard

**Files:**
- Create: `src/proxy.ts`
- Create: `tests/lib/proxy-config.test.ts`

**Interfaces:**
- Produces: a `proxy(request)` that refreshes the Supabase session cookie on every `/admin` request and optimistically redirects: unauthenticated → `/admin/login`; authenticated on `/admin/login` → `/admin`. Exports `config.matcher = ['/admin/:path*']`.

- [ ] **Step 1: Write the failing test** `tests/lib/proxy-config.test.ts` (asserts the matcher scopes proxy to `/admin`)

```ts
import { describe, it, expect } from 'vitest'
import { config } from '../../src/proxy'

describe('proxy config', () => {
  it('only runs on /admin routes', () => {
    expect(config.matcher).toContain('/admin/:path*')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/lib/proxy-config.test.ts`
Expected: FAIL — cannot find module `src/proxy`.

- [ ] **Step 3: Write** `src/proxy.ts`

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/supabase/database.types'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isLogin = path === '/admin/login'

  if (!user && !isLogin) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }
  if (user && isLogin) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
```

- [ ] **Step 4: Run the test**

Run: `npm test -- tests/lib/proxy-config.test.ts`
Expected: PASS.

- [ ] **Step 5: Manual verification** — unauthenticated redirect works.

Run: `npm run dev` then in another shell: `curl -sI http://localhost:3000/admin | grep -i location`
Expected: `location: /admin/login`

- [ ] **Step 6: Commit**

```bash
git add src/proxy.ts tests/lib/proxy-config.test.ts
git commit -m "feat: proxy session refresh and admin route guard"
```

---

## Task 10: Auth DAL + auth Server Actions

**Files:**
- Create: `src/lib/auth/dal.ts`
- Create: `src/lib/auth/validate.ts`
- Create: `src/app/admin/actions.ts`
- Create: `tests/lib/validate.test.ts`

**Interfaces:**
- Consumes: `createClient` server (Task 7).
- Produces:
  - `getCurrentStaff(): Promise<Staff | null>` — cached per request.
  - `requireStaff(): Promise<Staff>` — redirects to `/admin/login` if not an active staff.
  - `requireOwner(): Promise<Staff>` — redirects to `/admin` if not owner.
  - `type Staff` = row type of `public.staff`.
  - `validateCredentials(email, password): string | null` — returns an error string or null.
  - Server actions `login(prevState, formData): Promise<{ error: string } | void>` and `signOut(): Promise<void>`.

- [ ] **Step 1: Write the failing test** `tests/lib/validate.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { validateCredentials } from '../../src/lib/auth/validate'

describe('validateCredentials', () => {
  it('rejects empty email', () => {
    expect(validateCredentials('', 'pw')).toMatch(/email/i)
  })
  it('rejects empty password', () => {
    expect(validateCredentials('a@b.com', '')).toMatch(/password/i)
  })
  it('accepts valid input', () => {
    expect(validateCredentials('a@b.com', 'pw')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/lib/validate.test.ts`
Expected: FAIL — cannot find module `validate`.

- [ ] **Step 3: Write** `src/lib/auth/validate.ts`

```ts
export function validateCredentials(email: string, password: string): string | null {
  if (!email.trim()) return 'Email is required.'
  if (!password) return 'Password is required.'
  if (!email.includes('@')) return 'Enter a valid email.'
  return null
}
```

- [ ] **Step 4: Write** `src/lib/auth/dal.ts`

```ts
import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type Staff = Database['public']['Tables']['staff']['Row']

export const getCurrentStaff = cache(async (): Promise<Staff | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('staff').select('*').eq('id', user.id).single()
  return data ?? null
})

export async function requireStaff(): Promise<Staff> {
  const staff = await getCurrentStaff()
  if (!staff || !staff.active) redirect('/admin/login')
  return staff
}

export async function requireOwner(): Promise<Staff> {
  const staff = await requireStaff()
  if (staff.role !== 'owner') redirect('/admin')
  return staff
}
```

- [ ] **Step 5: Write** `src/app/admin/actions.ts`

```ts
'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { validateCredentials } from '@/lib/auth/validate'

export async function login(_prevState: { error: string } | undefined, formData: FormData) {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  const invalid = validateCredentials(email, password)
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  redirect('/admin')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}
```

- [ ] **Step 6: Run the test**

Run: `npm test -- tests/lib/validate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/ src/app/admin/actions.ts tests/lib/validate.test.ts
git commit -m "feat: auth DAL (requireStaff/requireOwner) and login/signout actions"
```

---

## Task 11: Admin login page

**Files:**
- Create: `src/app/admin/login/page.tsx`
- Create: `src/app/admin/login/login-form.tsx`

**Interfaces:**
- Consumes: `login` action (Task 10).
- Produces: a public (non-guarded by the shell) login route at `/admin/login` using `useActionState` for inline error display.

- [ ] **Step 1: Write the client form** `src/app/admin/login/login-form.tsx`

```tsx
'use client'
import { useActionState } from 'react'
import { login } from '../actions'

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined)
  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input name="email" type="email" required
          className="rounded-md border border-black/15 px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input name="password" type="password" required
          className="rounded-md border border-black/15 px-3 py-2" />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending}
        className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50">
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Write the page** `src/app/admin/login/page.tsx`

```tsx
import { LoginForm } from './login-form'

export const metadata = { title: 'Admin sign in · Kairo Labs' }

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Kairo Labs Admin</h1>
      <LoginForm />
    </main>
  )
}
```

- [ ] **Step 3: Verify it renders**

Run: `npm run dev` then `curl -sI http://localhost:3000/admin/login | head -1`
Expected: `HTTP/1.1 200 OK` (login page is reachable without a session).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/login/
git commit -m "feat: admin login page with inline error handling"
```

---

## Task 12: Admin shell layout + sidebar nav + sections config

**Files:**
- Create: `src/lib/admin/sections.ts`
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/admin-nav.tsx`
- Create: `tests/lib/sections.test.ts`

**Interfaces:**
- Consumes: `requireStaff` (Task 10), `signOut` (Task 10).
- Produces:
  - `ADMIN_SECTIONS: AdminSection[]` where `AdminSection = { slug: string; label: string; table: TableName; ownerOnly: boolean }` and `TableName` is a key of `Database['public']['Tables']`.
  - A guarded layout that renders the sidebar + topbar for all `/admin/*` pages **except** `/admin/login` (the login route opts out by being matched first; the layout calls `requireStaff()` which redirects unauthenticated users, and the login page renders its own full-screen `<main>`).

> **Note on layout + login:** `src/app/admin/layout.tsx` wraps every admin route including `/admin/login`. To avoid the login page being force-redirected by the layout guard, the guard runs `getCurrentStaff()` (not `requireStaff`) and only renders the chrome when staff exists; when there is no staff it renders `children` bare (so the login page shows). Proxy (Task 9) already handles the redirect for non-login admin routes.

- [ ] **Step 1: Write the failing test** `tests/lib/sections.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { ADMIN_SECTIONS } from '../../src/lib/admin/sections'

describe('admin sections', () => {
  it('defines all seven feature sections', () => {
    const slugs = ADMIN_SECTIONS.map((s) => s.slug)
    expect(slugs).toEqual([
      'dashboard', 'orders', 'products', 'inventory', 'affiliates', 'shipping', 'staff',
    ])
  })
  it('marks dashboard as owner-only', () => {
    expect(ADMIN_SECTIONS.find((s) => s.slug === 'dashboard')?.ownerOnly).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/lib/sections.test.ts`
Expected: FAIL — cannot find module `sections`.

- [ ] **Step 3: Write** `src/lib/admin/sections.ts`

```ts
import type { Database } from '@/lib/supabase/database.types'

export type TableName = keyof Database['public']['Tables']

export interface AdminSection {
  slug: string
  label: string
  /** Table used for the stub's live count. */
  table: TableName
  ownerOnly: boolean
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { slug: 'dashboard', label: 'Dashboard', table: 'orders', ownerOnly: true },
  { slug: 'orders', label: 'Orders', table: 'orders', ownerOnly: false },
  { slug: 'products', label: 'Products', table: 'products', ownerOnly: false },
  { slug: 'inventory', label: 'Inventory', table: 'product_sizes', ownerOnly: false },
  { slug: 'affiliates', label: 'Affiliates', table: 'affiliates', ownerOnly: false },
  { slug: 'shipping', label: 'Shipping', table: 'shipments', ownerOnly: false },
  { slug: 'staff', label: 'Staff', table: 'staff', ownerOnly: true },
]
```

- [ ] **Step 4: Write the nav** `src/app/admin/admin-nav.tsx`

```tsx
import Link from 'next/link'
import { ADMIN_SECTIONS } from '@/lib/admin/sections'
import { signOut } from './actions'
import type { Staff } from '@/lib/auth/dal'

export function AdminNav({ staff }: { staff: Staff }) {
  const visible = ADMIN_SECTIONS.filter((s) => !s.ownerOnly || staff.role === 'owner')
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-black/10 bg-neutral-50 p-4">
      <div className="mb-6 text-sm font-semibold tracking-tight">Kairo Labs Admin</div>
      <nav className="flex flex-col gap-1 text-sm">
        {visible.map((s) => (
          <Link key={s.slug}
            href={s.slug === 'dashboard' ? '/admin' : `/admin/${s.slug}`}
            className="rounded-md px-3 py-2 hover:bg-black/5">
            {s.label}
          </Link>
        ))}
      </nav>
      <form action={signOut} className="mt-auto pt-4">
        <div className="mb-2 text-xs text-black/50">{staff.email} · {staff.role}</div>
        <button className="w-full rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5">
          Sign out
        </button>
      </form>
    </aside>
  )
}
```

- [ ] **Step 5: Write the layout** `src/app/admin/layout.tsx`

```tsx
import { getCurrentStaff } from '@/lib/auth/dal'
import { AdminNav } from './admin-nav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff()

  // Unauthenticated (e.g. the /admin/login route): render bare. Proxy guards the rest.
  if (!staff || !staff.active) return <>{children}</>

  return (
    <div className="flex min-h-screen">
      <AdminNav staff={staff} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 6: Run the sections test**

Run: `npm test -- tests/lib/sections.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/admin/sections.ts src/app/admin/layout.tsx src/app/admin/admin-nav.tsx tests/lib/sections.test.ts
git commit -m "feat: admin shell layout, sidebar nav, and sections config"
```

---

## Task 13: Stub feature pages + dashboard

**Files:**
- Create: `src/app/admin/section-stub.tsx`
- Create: `src/app/admin/page.tsx` (Dashboard, owner-only)
- Create: `src/app/admin/orders/page.tsx`
- Create: `src/app/admin/products/page.tsx`
- Create: `src/app/admin/inventory/page.tsx`
- Create: `src/app/admin/affiliates/page.tsx`
- Create: `src/app/admin/shipping/page.tsx`
- Create: `src/app/admin/staff/page.tsx`

**Interfaces:**
- Consumes: `requireStaff`/`requireOwner` (Task 10), `createClient` server (Task 7), `ADMIN_SECTIONS` + `TableName` (Task 12).
- Produces: one wired, role-gated stub per section. Each renders a header, a "owned by a feature terminal" placeholder, and a **live row count** from its table — proving auth + RLS + data layer end-to-end.

- [ ] **Step 1: Write the shared stub component** `src/app/admin/section-stub.tsx`

```tsx
import { createClient } from '@/lib/supabase/server'
import type { TableName } from '@/lib/admin/sections'

export async function SectionStub({
  title,
  table,
  description,
}: {
  title: string
  table: TableName
  description: string
}) {
  const supabase = await createClient()
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })

  return (
    <section>
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <span className="text-sm text-black/50">{count ?? 0} rows in <code>{table}</code></span>
      </header>
      <div className="rounded-lg border border-dashed border-black/20 bg-neutral-50 p-8 text-sm text-black/60">
        <p className="mb-2 font-medium text-black/80">This section is a foundation stub.</p>
        <p>{description}</p>
        <p className="mt-3">A feature terminal owns the build-out — see <code>docs/admin-features/</code>.</p>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Write the Dashboard (index, owner-only)** `src/app/admin/page.tsx`

```tsx
import { requireOwner } from '@/lib/auth/dal'
import { SectionStub } from './section-stub'

export default async function DashboardPage() {
  await requireOwner()
  return (
    <SectionStub
      title="Dashboard"
      table="orders"
      description="Revenue and key metrics, aggregated from orders. Owner-only."
    />
  )
}
```

- [ ] **Step 3: Write the staff-accessible section pages.** Each is the same shape — repeated in full here (engineer may read tasks out of order):

`src/app/admin/orders/page.tsx`
```tsx
import { requireStaff } from '@/lib/auth/dal'
import { SectionStub } from '../section-stub'

export default async function OrdersPage() {
  await requireStaff()
  return <SectionStub title="Orders" table="orders"
    description="Create, track, and update customer orders and their payment status." />
}
```

`src/app/admin/products/page.tsx`
```tsx
import { requireStaff } from '@/lib/auth/dal'
import { SectionStub } from '../section-stub'

export default async function ProductsPage() {
  await requireStaff()
  return <SectionStub title="Products" table="products"
    description="Add, edit, and remove catalog products and their sizes/prices." />
}
```

`src/app/admin/inventory/page.tsx`
```tsx
import { requireStaff } from '@/lib/auth/dal'
import { SectionStub } from '../section-stub'

export default async function InventoryPage() {
  await requireStaff()
  return <SectionStub title="Inventory" table="product_sizes"
    description="Track stock on hand per SKU with an auditable movement ledger." />
}
```

`src/app/admin/affiliates/page.tsx`
```tsx
import { requireStaff } from '@/lib/auth/dal'
import { SectionStub } from '../section-stub'

export default async function AffiliatesPage() {
  await requireStaff()
  return <SectionStub title="Affiliates" table="affiliates"
    description="Manage referral partners, codes, commission rates, and payouts." />
}
```

`src/app/admin/shipping/page.tsx`
```tsx
import { requireStaff } from '@/lib/auth/dal'
import { SectionStub } from '../section-stub'

export default async function ShippingPage() {
  await requireStaff()
  return <SectionStub title="Shipping" table="shipments"
    description="Create shipping labels and track carrier, tracking number, and cost." />
}
```

`src/app/admin/staff/page.tsx` (owner-only)
```tsx
import { requireOwner } from '@/lib/auth/dal'
import { SectionStub } from '../section-stub'

export default async function StaffPage() {
  await requireOwner()
  return <SectionStub title="Staff" table="staff"
    description="Invite team members and set roles (owner / staff). Owner-only." />
}
```

- [ ] **Step 4: Create a first owner to verify the authed flow** (run against your Supabase target):

```bash
npx supabase --help >/dev/null # ensure CLI present
```
Then create a user and promote to owner (local SQL shell or Supabase Studio). Using the admin client one-off:
```bash
npx tsx -e "import('dotenv').then(d=>d.config({path:'.env.local'})).then(async()=>{const {createAdminClient}=await import('./src/lib/supabase/admin.ts');const a=createAdminClient();const {data,error}=await a.auth.admin.createUser({email:'owner@kairolabs.test',password:'kairo-owner-123',email_confirm:true});if(error)throw error;await a.from('staff').update({role:'owner',active:true,full_name:'Owner'}).eq('id',data.user.id);console.log('owner ready: owner@kairolabs.test / kairo-owner-123');})"
```
Expected: prints `owner ready: …`.

- [ ] **Step 5: Manual end-to-end verification**

Run `npm run dev`, then in a browser:
1. Visit `/admin` → redirected to `/admin/login`.
2. Sign in with `owner@kairolabs.test` / `kairo-owner-123` → land on Dashboard.
3. Sidebar shows all 7 sections (owner sees Dashboard + Staff).
4. Each section page shows its live row count (Products shows `13 rows in products`).
5. Sign out → back to `/admin/login`.

Expected: all five behaviors hold.

- [ ] **Step 6: Verify the full test suite is green**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/
git commit -m "feat: role-gated admin stub pages and owner dashboard"
```

---

## Task 14: Feature task briefs + runbook

**Files:**
- Create: `docs/admin-features/README.md`
- Create: `docs/admin-features/orders.md`
- Create: `docs/admin-features/products.md`
- Create: `docs/admin-features/inventory.md`
- Create: `docs/admin-features/affiliates.md`
- Create: `docs/admin-features/shipping.md`
- Create: `docs/admin-features/dashboard.md`
- Create: `docs/admin-features/staff.md`
- Modify: `README.md` (add an "Admin foundation" runbook section)

**Interfaces:**
- Produces: a one-page brief per feature so each terminal has a self-contained scope, plus a runbook for setup.

- [ ] **Step 1: Write** `docs/admin-features/README.md`

```markdown
# Admin feature terminals

Each feature below is built by one terminal against the shared foundation
(Supabase schema + `/admin` shell + DAL). Read your brief, then replace the
matching `src/app/admin/<slug>/page.tsx` stub.

## Rules of the road
- **Do not edit migrations 0001–0005.** Add new migrations (`0006_…`) if your
  feature needs new columns/tables; coordinate enum changes.
- **Use the DAL**: `requireStaff()` / `requireOwner()` at the top of every page
  and Server Action. Never trust the client.
- **Use the typed clients**: `@/lib/supabase/server` (user/RLS) for reads/writes
  in pages and actions; `@/lib/supabase/admin` only for trusted server scripts.
- **Regenerate types** after any schema change: `npm run db:types`.
- **Write tests** under `tests/` following the existing Vitest patterns.
- **Do not touch the public storefront** (`src/app/page.tsx`, `src/components/*`,
  `src/lib/products.ts`).

| Feature | Slug | Owner-only | Primary tables |
|---|---|---|---|
| Dashboard | `dashboard` (`/admin`) | yes | `orders`, `payments` |
| Orders | `orders` | no | `orders`, `order_items`, `payments` |
| Products | `products` | no | `products`, `product_sizes` |
| Inventory | `inventory` | no | `inventory`, `inventory_movements` |
| Affiliates | `affiliates` | no | `affiliates`, `orders.affiliate_id` |
| Shipping | `shipping` | no | `shipments`, `orders` |
| Staff | `staff` | yes | `staff` (Supabase Auth admin API) |
```

- [ ] **Step 2: Write each feature brief.** Use this template for all seven files, filling the bracketed parts from the table below:

```markdown
# <Feature> — terminal brief

**Route:** `src/app/admin/<slug>/page.tsx` (replace the stub)
**Tables you own:** <tables>
**Access:** <requireStaff | requireOwner>

## Goal
<one-paragraph goal>

## Definition of done
- [ ] <capability 1>
- [ ] <capability 2>
- [ ] <capability 3>
- [ ] RLS respected (no service-role client in request paths)
- [ ] Tests under `tests/` cover the data-access functions
- [ ] Types regenerated if schema changed
```

Fill each file:
- `orders.md` — tables `orders`, `order_items`, `payments`; access `requireStaff`. DoD: create/edit orders with line items pulled from `product_sizes`; set `payment_method`/`payment_status`; record `payments`; on status→`paid`, write `inventory_movements` (reason `sale`) decrementing stock.
- `products.md` — tables `products`, `product_sizes`; access `requireStaff`. DoD: list/create/edit/deactivate products; manage sizes/prices/SKUs; image upload to Supabase Storage.
- `inventory.md` — tables `inventory`, `inventory_movements`; access `requireStaff`. DoD: view stock per SKU; restock/adjust writes a movement; low-stock highlight vs `reorder_threshold`.
- `affiliates.md` — tables `affiliates`, `orders.affiliate_id`; access `requireStaff`. DoD: CRUD affiliates + referral codes; attribute orders; compute commission owed from attributed orders.
- `shipping.md` — tables `shipments`, `orders`; access `requireStaff`. DoD: create a shipment per order; store carrier/tracking/label URL/cost; (label-API integration is a later sub-task).
- `dashboard.md` — tables `orders`, `payments`; access `requireOwner`. DoD: revenue totals (day/week/month), order counts by status, top products; reads aggregate from `orders`.
- `staff.md` — table `staff` + Supabase Auth admin API; access `requireOwner`. DoD: invite staff (create auth user → staff row), set role, activate/deactivate.

- [ ] **Step 3: Add a runbook section to `README.md`** (append; do not remove existing content):

```markdown
## Admin foundation (setup)

1. Install Docker Desktop (for local Supabase) **or** create a cloud Supabase project.
2. `npm install`
3. `npx supabase start` (local) or `npx supabase link` + `npx supabase db push` (cloud)
4. Copy keys into `.env.local` (see `.env.example`).
5. `npm run db:reset` — apply migrations.
6. `npm run db:seed` — seed the product catalog.
7. Create a first owner (see `docs/admin-features/staff.md`).
8. `npm run dev` → visit `/admin`.

Tests: `npm test`. Regenerate DB types after schema changes: `npm run db:types`.
```

- [ ] **Step 4: Commit**

```bash
git add docs/admin-features/ README.md
git commit -m "docs: admin feature terminal briefs and setup runbook"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Supabase schema/migrations → Tasks 2–6. ✓
- Secure staff auth + Owner/Staff roles, server-side → Tasks 2, 9, 10. ✓
- RLS on every table, revenue gated to owner → every schema task + dashboard `requireOwner` (Task 13). ✓
- `/admin` shell + sidebar + topbar → Task 12. ✓
- Shared typed data layer (SSR clients + generated types) → Task 7. ✓
- Catalog seeded from `products.ts`, storefront untouched → Task 8 + Global Constraints. ✓
- Stub page per feature with live count + role gating → Task 13. ✓
- Per-feature task briefs → Task 14. ✓
- Manual-now / processor-later payments model → Task 5 (`payments` table + enums). ✓
- Affiliate attribution ready now, portal later → Task 6 (`affiliates` + `orders.affiliate_id`). ✓
- Testing approach (migrations apply, RLS denies anon, seed counts, auth redirect) → Tasks 2–9, 13. ✓

**Placeholder scan:** No "TBD/TODO/handle edge cases" in code steps; feature-brief bracketed parts are explicitly enumerated in Task 14 Step 2. ✓

**Type consistency:** `createClient` (server/browser), `createAdminClient`, `Staff`, `AdminSection`, `TableName`, `ADMIN_SECTIONS`, `getCurrentStaff`/`requireStaff`/`requireOwner`, `validateCredentials`, `login`/`signOut`, `SectionStub` — names match across all tasks. SKU format `<CODE>-<MG uppercased, spaces removed>` consistent between Task 8 script and tests. ✓

**Known prerequisite:** Docker (local) or a cloud Supabase project must exist before Task 1 Step 3. Flagged in Prerequisite section.
