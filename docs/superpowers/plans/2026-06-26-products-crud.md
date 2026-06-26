# Products CRUD + Live Storefront Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/admin/products` management UI and make the public storefront read its catalog from the database, so admin edits go live.

**Architecture:** The database (`products` + `product_sizes`) becomes the single source of truth. Public pages read via a cookieless anon Supabase client wrapped in `unstable_cache` (tag `catalog`); admin reads/writes via the cookie server client (RLS = staff). Write actions call `revalidateTag('catalog')` so the site refreshes within seconds.

**Tech Stack:** Next.js 16.2.9 (App Router, Cache Components OFF → `unstable_cache`/`revalidateTag`), Supabase (Postgres + RLS + Storage), Vitest, Tailwind, zod.

## Global Constraints

- Next.js 16.2.9, **Cache Components disabled** → use `unstable_cache` + `revalidateTag`, never `'use cache'`. Read `node_modules/next/dist/docs/` before writing Next code.
- Migration number for this feature is **`0006`**. Do NOT edit migrations `0001`–`0005`. New migrations MUST `GRANT` to `service_role` and `authenticated` (and `anon` where public).
- Server actions live in `src/app/admin/products/actions.ts` — never the shared `src/app/admin/actions.ts`.
- Use the DAL: `requireStaff()` at the top of every admin page and action. Use `@/lib/supabase/server` in request paths; `@/lib/supabase/admin` (service role) only in trusted scripts/tests, never a request path.
- Soft-delete only (`active` flag). Single `image` per product. Static content (`PRODUCT_DETAILS`, `ACCESSORIES`, `VOLUME_TIERS`, helpers) stays in `src/lib/products.ts`.
- Tests under `tests/`, Vitest, service-role client per `tests/setup.ts`; `fileParallelism: false`.
- Run `npm run db:types` after any schema change.
- Commit after every task.

---

### Task 1: Migration 0006 — public read RLS, `compare_at`, Storage bucket

**Files:**
- Create: `supabase/migrations/0006_products_public_and_storage.sql`
- Test: `tests/db/products-public.test.ts`
- Regenerate: `src/lib/supabase/database.types.ts`

**Interfaces:**
- Produces: `products.compare_at numeric(10,2)` column; anon SELECT on active products + all sizes; Storage bucket `product-images` (public read, staff write).

- [ ] **Step 1: Write the migration**

```sql
-- 0006_products_public_and_storage.sql
-- Make the catalog publicly readable, add bundle compare-at price,
-- and create the product image storage bucket.

-- 1. compare-at price for bundle savings
alter table public.products add column compare_at numeric(10,2);

-- 2. public read of ACTIVE products (staff keep full read via is_staff() policy)
create policy "public read active products" on public.products
  for select to anon, authenticated
  using (active = true);

create policy "public read sizes" on public.product_sizes
  for select to anon, authenticated
  using (true);

grant select on public.products to anon;
grant select on public.product_sizes to anon;

-- 3. product image storage bucket
insert into storage.buckets (id, name, public)
  values ('product-images', 'product-images', true)
  on conflict (id) do nothing;

create policy "public read product images" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

create policy "staff upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_staff());

create policy "staff update product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_staff());
```

- [ ] **Step 2: Apply the migration and regenerate types**

Run: `npm run db:reset && npm run db:types`
Expected: reset completes, `database.types.ts` now shows `compare_at` on `products`.

- [ ] **Step 3: Write the failing RLS test**

```ts
// tests/db/products-public.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const admin = createClient(url, service, { auth: { persistSession: false } })
const anon = createClient(url, anonKey, { auth: { persistSession: false } })

describe('public catalog RLS', () => {
  let activeId: string
  let inactiveId: string

  beforeAll(async () => {
    const a = await admin.from('products')
      .insert({ code: 'PUB-ACTIVE', name: 'Active', category: 'Recovery & Repair', active: true })
      .select().single()
    activeId = a.data!.id
    const i = await admin.from('products')
      .insert({ code: 'PUB-INACTIVE', name: 'Inactive', category: 'Recovery & Repair', active: false })
      .select().single()
    inactiveId = i.data!.id
  })

  it('anon can read active products', async () => {
    const { data } = await anon.from('products').select('*').eq('id', activeId)
    expect(data).toHaveLength(1)
  })

  it('anon cannot read inactive products', async () => {
    const { data } = await anon.from('products').select('*').eq('id', inactiveId)
    expect(data).toHaveLength(0)
  })

  it('anon cannot insert products', async () => {
    const { error } = await anon.from('products')
      .insert({ code: 'PUB-HACK', name: 'x', category: 'Recovery & Repair' })
    expect(error).not.toBeNull()
  })

  afterAll: // cleanup
})
```

Replace the `afterAll:` placeholder line with:

```ts
  it('cleanup', async () => {
    await admin.from('products').delete().in('code', ['PUB-ACTIVE', 'PUB-INACTIVE'])
  })
```

- [ ] **Step 4: Run the test**

Run: `npm test -- products-public`
Expected: PASS (3 assertions + cleanup).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_products_public_and_storage.sql tests/db/products-public.test.ts src/lib/supabase/database.types.ts
git commit -m "feat(products): migration 0006 — public catalog RLS, compare_at, storage bucket"
```

---

### Task 2: Seed fixture refactor

**Files:**
- Create: `scripts/seed-data.ts`
- Modify: `src/lib/products.ts` (remove `PRODUCTS` array + `FEATURED`/`BESTSELLERS`; keep types/helpers/static content)
- Modify: `scripts/seed-products.ts` (import from `seed-data`, write `compare_at`)
- Modify: `tests/db/seed.test.ts` (import `SEED_PRODUCTS` from `seed-data`)

**Interfaces:**
- Produces: `SEED_PRODUCTS: SeedProduct[]` in `scripts/seed-data.ts`, where `SeedProduct` carries every column needed to seed (`code,name,sub,category,image,mechanism,tagline,purity,rating,reviews,bestseller,featured,blurb,compareAt?,sizes`).

- [ ] **Step 1: Create `scripts/seed-data.ts`** — move the current `PRODUCTS` array (all 13 entries) verbatim out of `src/lib/products.ts` into this file, exported as `SEED_PRODUCTS`. Keep the `Product`-shaped objects (including `compareAt` where present). Import the `Product` type from `@/lib/products`.

```ts
import type { Product } from '@/lib/products'
export const SEED_PRODUCTS: Product[] = [ /* the 13 entries moved verbatim */ ]
```

- [ ] **Step 2: Trim `src/lib/products.ts`** — delete the `PRODUCTS` array and the two derived consts:

```ts
// DELETE these three:
export const PRODUCTS: Product[] = [ ...13 entries... ];
export const FEATURED = PRODUCTS.filter((p) => p.featured);
export const BESTSELLERS = PRODUCTS.filter((p) => p.bestseller);
```

Keep everything else (types, `CATEGORIES`, `CATEGORY_META`, helpers, `PRODUCT_DETAILS`, `ACCESSORIES`, etc.). Change the lookup helpers that referenced `PRODUCTS` to take an explicit list:

```ts
export function productBySlug(list: Product[], slug: string): Product | undefined {
  return list.find((p) => productSlug(p) === slug)
}
export function relatedProducts(list: Product[], p: Product, n = 3): Product[] {
  return list.filter((x) => x.category === p.category && x.code !== p.code).slice(0, n)
}
export function categoryCount(list: Product[], category: Category): number {
  return list.filter((p) => p.category === category).length
}
```

- [ ] **Step 3: Update `scripts/seed-products.ts`** — change the import and add `compare_at`:

```ts
import { SEED_PRODUCTS } from './seed-data'
// ...in the loop, replace `for (const p of PRODUCTS)` with `for (const p of SEED_PRODUCTS)`
// and add compare_at to the product upsert payload:
//   bestseller: p.bestseller, featured: p.featured, blurb: p.blurb,
//   compare_at: p.compareAt ?? null,
```

- [ ] **Step 4: Update `tests/db/seed.test.ts`** — replace `import { PRODUCTS } from '../../src/lib/products'` with `import { SEED_PRODUCTS } from '../../scripts/seed-data'` and use `SEED_PRODUCTS.length`.

- [ ] **Step 5: Run seed + tests**

Run: `npm run db:reset && npm test -- seed`
Expected: PASS (`seeds every product`, `creates an inventory row for every size`).

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-data.ts scripts/seed-products.ts src/lib/products.ts tests/db/seed.test.ts
git commit -m "refactor(products): move seed data to fixture; lookups take explicit list"
```

---

### Task 3: Catalog read layer

**Files:**
- Create: `src/lib/catalog/client.ts`
- Create: `src/lib/catalog/queries.ts`
- Test: `tests/lib/catalog.test.ts`

**Interfaces:**
- Consumes: `Product` type and helpers from `@/lib/products`.
- Produces:
  - `createPublicClient(): SupabaseClient<Database>` (cookieless anon).
  - `getCatalog(): Promise<Product[]>` — active products mapped to `Product`, cached with tag `catalog`.
  - `getProductBySlug(slug: string): Promise<Product | undefined>`.
  - `getFeatured(): Promise<Product[]>`, `getBestsellers(): Promise<Product[]>`.
  - `getRelated(p: Product, n?: number): Promise<Product[]>`.

- [ ] **Step 1: Write the cookieless client**

```ts
// src/lib/catalog/client.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/lib/catalog.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { execSync } from 'node:child_process'
import { getCatalog, getProductBySlug } from '../../src/lib/catalog/queries'

describe('catalog read layer', () => {
  beforeAll(() => { execSync('npm run db:seed', { stdio: 'inherit' }) })

  it('returns active products mapped to Product shape', async () => {
    const list = await getCatalog()
    expect(list.length).toBeGreaterThan(0)
    const bpc = list.find((p) => p.code === 'BPC-157')!
    expect(bpc.name).toBe('BPC-157')
    expect(bpc.sizes.length).toBeGreaterThan(0)
    expect(bpc.sizes[0]).toHaveProperty('mg')
    expect(bpc.sizes[0]).toHaveProperty('price')
  })

  it('maps compare_at to compareAt for bundles', async () => {
    const list = await getCatalog()
    const blend = list.find((p) => p.category === 'Blends & Stacks')
    expect(blend).toBeDefined()
  })

  it('looks up a product by slug', async () => {
    const p = await getProductBySlug('bpc-157')
    expect(p?.code).toBe('BPC-157')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- catalog`
Expected: FAIL ("Cannot find module .../queries").

- [ ] **Step 4: Implement `queries.ts`**

```ts
// src/lib/catalog/queries.ts
import { unstable_cache } from 'next/cache'
import { createPublicClient } from './client'
import {
  type Product, type Category, type SizeOption,
  CATEGORIES, productSlug,
} from '@/lib/products'

type Row = {
  code: string; name: string; sub: string | null; category: string
  image: string | null; mechanism: string | null; tagline: string | null
  purity: string | null; rating: number | null; reviews: number | null
  bestseller: boolean; featured: boolean; blurb: string | null
  compare_at: number | null
  product_sizes: { mg: string; price: number }[]
}

function toProduct(r: Row): Product {
  const category = (CATEGORIES.includes(r.category as Category)
    ? r.category : r.category) as Category
  const sizes: SizeOption[] = [...r.product_sizes]
    .sort((a, b) => a.price - b.price)
    .map((s) => ({ mg: s.mg, price: Number(s.price) }))
  return {
    code: r.code, name: r.name, sub: r.sub ?? '', category,
    image: r.image ?? '', mechanism: r.mechanism ?? '', tagline: r.tagline ?? '',
    purity: r.purity ?? '', sizes,
    rating: Number(r.rating ?? 0), reviews: r.reviews ?? 0,
    bestseller: r.bestseller, featured: r.featured, blurb: r.blurb ?? '',
    compareAt: r.compare_at ?? undefined,
  }
}

export const getCatalog = unstable_cache(
  async (): Promise<Product[]> => {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('products')
      .select('code,name,sub,category,image,mechanism,tagline,purity,rating,reviews,bestseller,featured,blurb,compare_at,product_sizes(mg,price)')
      .eq('active', true)
    if (error) throw error
    return (data as Row[]).map(toProduct)
  },
  ['catalog'],
  { tags: ['catalog'], revalidate: 3600 },
)

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  return (await getCatalog()).find((p) => productSlug(p) === slug)
}
export async function getFeatured(): Promise<Product[]> {
  return (await getCatalog()).filter((p) => p.featured)
}
export async function getBestsellers(): Promise<Product[]> {
  return (await getCatalog()).filter((p) => p.bestseller)
}
export async function getRelated(p: Product, n = 3): Promise<Product[]> {
  return (await getCatalog()).filter((x) => x.category === p.category && x.code !== p.code).slice(0, n)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- catalog`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/catalog tests/lib/catalog.test.ts
git commit -m "feat(catalog): DB-backed catalog read layer with cache tag"
```

---

### Task 4: Storefront consumes the read layer

**Files:**
- Modify: `src/app/page.tsx` (home)
- Modify: `src/components/category-tabs.tsx`
- Create: `src/app/catalog/catalog-browser.tsx` (client; moved logic)
- Modify: `src/app/catalog/page.tsx` (server wrapper)
- Modify: `src/app/product/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getCatalog`, `getBestsellers`, `getProductBySlug`, `getRelated` from `@/lib/catalog/queries`; updated `productBySlug`/`relatedProducts` signatures from Task 2.

- [ ] **Step 1: Home page** — make `src/app/page.tsx` async; replace `import { BESTSELLERS, PRODUCTS }` with `import { getCatalog, getBestsellers } from '@/lib/catalog/queries'`. Compute at the top of the component:

```tsx
export default async function Home() {
  const products = await getCatalog()
  const bestsellers = await getBestsellers()
  const feature = products.find((p) => p.code === 'Retatrutide')!
  // ...pass `products`/`bestsellers`/`feature` where the consts were used;
  //    pass `products` to <CategoryTabs products={products} />
}
```

Remove the module-level `const FEATURE = PRODUCTS.find(...)` and use the local `feature`.

- [ ] **Step 2: CategoryTabs** — change `src/components/category-tabs.tsx` to accept products as a prop instead of importing `PRODUCTS`:

```tsx
import { CATEGORY_META, type Category, type Product } from "@/lib/products";
export function CategoryTabs({ products }: { products: Product[] }) {
  const [active, setActive] = useState<Category>(CATEGORY_META[0].name);
  const meta = CATEGORY_META.find((c) => c.name === active)!;
  const filtered = products.filter((p) => p.category === active);
  // ...use `filtered` instead of the old `products` local
}
```

- [ ] **Step 3: Catalog browser (client)** — create `src/app/catalog/catalog-browser.tsx` with the current contents of `catalog/page.tsx` (the `"use client"` filter/sort UI), but: keep `"use client"`, accept `{ products }: { products: Product[] }` as a prop, and remove the `PRODUCTS` import (use the prop). Keep importing `CATEGORIES`, `fromPrice`, `FilterCategory` from `@/lib/products`.

- [ ] **Step 4: Catalog server page** — replace `src/app/catalog/page.tsx` with a server component:

```tsx
import { getCatalog } from "@/lib/catalog/queries";
import { CatalogBrowser } from "./catalog-browser";

export default async function CatalogPage() {
  const products = await getCatalog();
  return <CatalogBrowser products={products} />;
}
```

- [ ] **Step 5: Detail page** — update `src/app/product/[slug]/page.tsx`:

```tsx
import { getCatalog, getProductBySlug, getRelated } from "@/lib/catalog/queries";
import { productSlug, productDetail } from "@/lib/products";

export async function generateStaticParams() {
  const products = await getCatalog();
  return products.map((p) => ({ slug: productSlug(p) }));
}
// in generateMetadata + the page: const product = await getProductBySlug(slug)
// related: const related = await getRelated(product)
// pass `related` to <ProductDetailView /> (replace the old relatedProducts(product) call)
```

`dynamicParams` defaults to `true`, so products added after build still render on demand.

- [ ] **Step 6: Typecheck + build the storefront**

Run: `npm run build`
Expected: build succeeds; no references to the removed `PRODUCTS`/`BESTSELLERS`/`FEATURED` remain (grep to confirm: `grep -rn "PRODUCTS\b" src` returns nothing outside comments).

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/components/category-tabs.tsx src/app/catalog src/app/product
git commit -m "feat(storefront): read catalog from DB via catalog read layer"
```

---

### Task 5: Admin products list page

**Files:**
- Modify: `src/app/admin/products/page.tsx` (replace stub)
- Create: `src/app/admin/products/product-list.tsx` (server-rendered table)
- Test: `tests/lib/admin-products.test.ts` (data-access assertions)

**Interfaces:**
- Consumes: `requireStaff` from `@/lib/auth/dal`; `createClient` from `@/lib/supabase/server`.
- Produces: a list view at `/admin/products` showing all products (active + inactive) with size count, category, status, price range, and Edit / New links.

- [ ] **Step 1: Replace the stub** `src/app/admin/products/page.tsx`:

```tsx
import Link from 'next/link'
import { requireStaff } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'

export default async function ProductsPage() {
  await requireStaff()
  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('id,code,name,category,active,product_sizes(price)')
    .order('name')

  return (
    <section>
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <Link href="/admin/products/new" className="rounded-md bg-black px-3 py-1.5 text-sm text-white">New product</Link>
      </header>
      <table className="w-full text-sm">
        <thead className="text-left text-black/50">
          <tr><th className="py-2">Name</th><th>Category</th><th>Sizes</th><th>Price</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {(products ?? []).map((p) => {
            const prices = p.product_sizes.map((s) => Number(s.price))
            const range = prices.length ? `$${Math.min(...prices)}–$${Math.max(...prices)}` : '—'
            return (
              <tr key={p.id} className="border-t border-black/10">
                <td className="py-2 font-medium">{p.name} <span className="text-black/40">{p.code}</span></td>
                <td>{p.category}</td>
                <td>{p.product_sizes.length}</td>
                <td>{range}</td>
                <td>{p.active ? <span className="text-emerald-600">Active</span> : <span className="text-black/40">Inactive</span>}</td>
                <td className="text-right"><Link href={`/admin/products/${p.id}/edit`} className="text-blue-600">Edit</Link></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
```

(No separate `product-list.tsx` file is needed; the table is inline. Skip creating it.)

- [ ] **Step 2: Verify it renders**

Run: `npm run build`
Expected: build succeeds; `/admin/products` compiles.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/products/page.tsx
git commit -m "feat(admin): products list page replaces stub"
```

---

### Task 6: Product validation schema + create/update/soft-delete actions

**Files:**
- Create: `src/app/admin/products/schema.ts`
- Create: `src/app/admin/products/actions.ts`
- Test: `tests/lib/admin-products.test.ts`

**Interfaces:**
- Consumes: `requireStaff` (`@/lib/auth/dal`), `createClient` (`@/lib/supabase/server`), `revalidateTag` (`next/cache`), zod.
- Produces:
  - `productSchema` (zod) and `SizeInput`/`ProductInput` types.
  - `createProduct(input): Promise<ActionResult>` — inserts product + sizes.
  - `updateProduct(id, input): Promise<ActionResult>` — updates fields + syncs sizes.
  - `setProductActive(id, active): Promise<ActionResult>`.
  - `deleteSize(sizeId): Promise<ActionResult>` — blocks deleting the last size.
  - `ActionResult = { ok: true } | { ok: false, error: string }`.

- [ ] **Step 1: Write the schema** `src/app/admin/products/schema.ts`:

```ts
import { z } from 'zod'
import { CATEGORIES } from '@/lib/products'

const category = z.enum(CATEGORIES.filter((c) => c !== 'All') as [string, ...string[]])

export const sizeSchema = z.object({
  id: z.string().uuid().optional(),
  mg: z.string().min(1),
  price: z.number().positive(),
  sku: z.string().min(1),
})

export const productSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  sub: z.string().optional().default(''),
  category,
  image: z.string().optional().default(''),
  mechanism: z.string().optional().default(''),
  tagline: z.string().optional().default(''),
  purity: z.string().optional().default(''),
  blurb: z.string().optional().default(''),
  rating: z.number().min(0).max(5).default(0),
  reviews: z.number().int().min(0).default(0),
  bestseller: z.boolean().default(false),
  featured: z.boolean().default(false),
  compareAt: z.number().positive().optional(),
  sizes: z.array(sizeSchema).min(1),
})

export type ProductInput = z.infer<typeof productSchema>
export type SizeInput = z.infer<typeof sizeSchema>
```

- [ ] **Step 2: Write the failing test** `tests/lib/admin-products.test.ts`:

```ts
import { describe, it, expect, afterAll } from 'vitest'
import { createProduct, updateProduct, setProductActive, deleteSize } from '../../src/app/admin/products/actions'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

// NOTE: actions call requireStaff(); in tests we stub the server client to a
// service-role client. See Step 3 for the test-mode shim.

const base = {
  code: 'ADM-TEST', name: 'Admin Test', category: 'Recovery & Repair' as const,
  sizes: [{ mg: '5 mg', price: 10, sku: 'ADM-TEST-5MG' }],
}

afterAll(async () => { await admin.from('products').delete().eq('code', 'ADM-TEST') })

describe('product actions', () => {
  let id: string
  it('creates a product with a size', async () => {
    const r = await createProduct(base)
    expect(r.ok).toBe(true)
    const { data } = await admin.from('products').select('id,product_sizes(id)').eq('code', 'ADM-TEST').single()
    id = data!.id
    expect(data!.product_sizes).toHaveLength(1)
  })
  it('rejects duplicate code', async () => {
    const r = await createProduct(base)
    expect(r.ok).toBe(false)
  })
  it('soft-deletes (deactivates)', async () => {
    const r = await setProductActive(id, false)
    expect(r.ok).toBe(true)
    const { data } = await admin.from('products').select('active').eq('id', id).single()
    expect(data!.active).toBe(false)
  })
  it('blocks deleting the last size', async () => {
    const { data } = await admin.from('product_sizes').select('id').eq('sku', 'ADM-TEST-5MG').single()
    const r = await deleteSize(data!.id)
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 3: Implement actions** `src/app/admin/products/actions.ts`:

```ts
'use server'
import { revalidateTag } from 'next/cache'
import { requireStaff } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { productSchema, type ProductInput } from './schema'

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

export async function createProduct(input: ProductInput): Promise<ActionResult> {
  await requireStaff()
  const parsed = productSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  const supabase = await createClient()
  const { data: product, error } = await supabase.from('products').insert({
    code: v.code, name: v.name, sub: v.sub, category: v.category, image: v.image,
    mechanism: v.mechanism, tagline: v.tagline, purity: v.purity, blurb: v.blurb,
    rating: v.rating, reviews: v.reviews, bestseller: v.bestseller, featured: v.featured,
    compare_at: v.compareAt ?? null,
  }).select('id').single()
  if (error) return { ok: false, error: error.message }
  const { error: sErr } = await supabase.from('product_sizes').insert(
    v.sizes.map((s) => ({ product_id: product.id, mg: s.mg, price: s.price, sku: s.sku })),
  )
  if (sErr) return { ok: false, error: sErr.message }
  revalidateTag('catalog')
  return { ok: true, id: product.id }
}

export async function updateProduct(id: string, input: ProductInput): Promise<ActionResult> {
  await requireStaff()
  const parsed = productSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from('products').update({
    code: v.code, name: v.name, sub: v.sub, category: v.category, image: v.image,
    mechanism: v.mechanism, tagline: v.tagline, purity: v.purity, blurb: v.blurb,
    rating: v.rating, reviews: v.reviews, bestseller: v.bestseller, featured: v.featured,
    compare_at: v.compareAt ?? null, updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  for (const s of v.sizes) {
    if (s.id) {
      await supabase.from('product_sizes').update({ mg: s.mg, price: s.price, sku: s.sku }).eq('id', s.id)
    } else {
      const { error: iErr } = await supabase.from('product_sizes').insert({ product_id: id, mg: s.mg, price: s.price, sku: s.sku })
      if (iErr) return { ok: false, error: iErr.message }
    }
  }
  revalidateTag('catalog')
  return { ok: true }
}

export async function setProductActive(id: string, active: boolean): Promise<ActionResult> {
  await requireStaff()
  const supabase = await createClient()
  const { error } = await supabase.from('products').update({ active }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidateTag('catalog')
  return { ok: true }
}

export async function deleteSize(sizeId: string): Promise<ActionResult> {
  await requireStaff()
  const supabase = await createClient()
  const { data: size } = await supabase.from('product_sizes').select('product_id').eq('id', sizeId).single()
  if (!size) return { ok: false, error: 'Size not found' }
  const { count } = await supabase.from('product_sizes').select('*', { count: 'exact', head: true }).eq('product_id', size.product_id)
  if ((count ?? 0) <= 1) return { ok: false, error: 'A product must keep at least one size' }
  const { error } = await supabase.from('product_sizes').delete().eq('id', sizeId)
  if (error) return { ok: false, error: error.message }
  revalidateTag('catalog')
  return { ok: true }
}
```

- [ ] **Step 4: Test-mode shim for `requireStaff`/server client** — because the actions import `@/lib/supabase/server` (cookie-based) and `requireStaff()` (which redirects when unauthenticated), tests need these to resolve to a service-role client. Add a Vitest mock at the top of `tests/lib/admin-products.test.ts`:

```ts
import { vi } from 'vitest'
vi.mock('@/lib/auth/dal', () => ({ requireStaff: async () => ({ id: 'test', role: 'owner', active: true }) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    const { createClient } = await import('@supabase/supabase-js')
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  },
}))
```

Also mock `next/cache` so `revalidateTag` is a no-op in tests:

```ts
vi.mock('next/cache', () => ({ revalidateTag: () => {} }))
```

- [ ] **Step 5: Run the tests**

Run: `npm run db:reset && npm test -- admin-products`
Expected: PASS (create, reject duplicate, soft-delete, block last-size deletion).

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/products/schema.ts src/app/admin/products/actions.ts tests/lib/admin-products.test.ts
git commit -m "feat(admin): product create/update/soft-delete actions with validation"
```

---

### Task 7: Product form (create + edit) and image upload

**Files:**
- Create: `src/app/admin/products/product-form.tsx` (client)
- Create: `src/app/admin/products/new/page.tsx` (server)
- Create: `src/app/admin/products/[id]/edit/page.tsx` (server)
- Modify: `src/app/admin/products/actions.ts` (add `uploadProductImage`)

**Interfaces:**
- Consumes: `createProduct`, `updateProduct` from `actions.ts`; `CATEGORIES` from `@/lib/products`.
- Produces: `uploadProductImage(formData: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }>`; a reusable `<ProductForm mode="create" | "edit" initial={...} productId={...} />`.

- [ ] **Step 1: Add the upload action** to `src/app/admin/products/actions.ts`:

```ts
export async function uploadProductImage(formData: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireStaff()
  const file = formData.get('file') as File | null
  const code = String(formData.get('code') || 'misc')
  if (!file) return { ok: false, error: 'No file' }
  const supabase = await createClient()
  const path = `${code}/${Date.now()}-${file.name}`
  const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
  if (error) return { ok: false, error: error.message }
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return { ok: true, url: data.publicUrl }
}
```

- [ ] **Step 2: Build `product-form.tsx`** (client) — a form with all fields from the schema, a category `<select>` (from `CATEGORIES` minus `All`), a repeatable sizes editor (add/remove rows; SKU auto-suggested as `${code}-${mg.replace(/\s+/g,'').toUpperCase()}`), an image `<input type="file">` that calls `uploadProductImage` and stores the returned URL in state, and a submit that calls `createProduct` or `updateProduct` and shows `result.error` on failure, else `router.push('/admin/products')`. Block submit when sizes is empty. Use `"use client"`, `useState`, `useRouter` from `next/navigation`.

- [ ] **Step 3: Create route pages**

```tsx
// src/app/admin/products/new/page.tsx
import { requireStaff } from '@/lib/auth/dal'
import { ProductForm } from '../product-form'
export default async function NewProductPage() {
  await requireStaff()
  return <ProductForm mode="create" />
}
```

```tsx
// src/app/admin/products/[id]/edit/page.tsx
import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { ProductForm } from '../../product-form'
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff()
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('products').select('*, product_sizes(*)').eq('id', id).single()
  if (!data) notFound()
  return <ProductForm mode="edit" productId={id} initial={data} />
}
```

- [ ] **Step 4: Build + manual smoke**

Run: `npm run build`
Expected: build succeeds. Manually (dev server) create a product, confirm it appears in the list and on the storefront after refresh.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/products
git commit -m "feat(admin): product create/edit form with image upload"
```

---

### Task 8: End-to-end verification

- [ ] **Step 1: Full test suite**

Run: `npm run db:reset && npm test`
Expected: all tests pass.

- [ ] **Step 2: Manual loop check (dev server)** — `npm run dev`:
  - Log into `/admin`, open Products, edit BPC-157's price, save.
  - Open the storefront catalog → confirm the new price shows (revalidateTag fired).
  - Deactivate a product → confirm it disappears from the public catalog but still shows (Inactive) in admin.

- [ ] **Step 3: Lint + typecheck**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 4: Final commit (if any cleanup)**

```bash
git add -A && git commit -m "chore(products): e2e verification cleanup"
```

---

## Notes for the implementer

- The `category` zod enum casts `CATEGORIES` (which includes `'All'`) — filter `'All'` out as shown.
- `unstable_cache` cannot read cookies; that's why the public client (Task 3) is cookieless. Never swap it for `@/lib/supabase/server`.
- If `npm run db:reset` is slow, the seed-dependent tests (`catalog`, `seed`, `admin-products`) each reset/seed; keep `fileParallelism: false` (already set).
- After merging `main`, re-run `npm run db:types` — the generated types file is a known merge point with the other terminals.
