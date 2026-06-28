# Checkout Integration onto `main` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land our storefront checkout + manual P2P payment step on top of `main`, replacing main's incomplete cart/checkout (which explicitly stops at "pending" per its `HANDOFF.md`) while preserving everything else main shipped.

**Architecture:** `main` already has a cart→checkout→order-creation seam plus staff management, brand/favicon, and sitewide styling. Our reviewed checkout feature (branch `feat/storefront-checkout` @ `66d7106`) has the missing payment step (method selection, payment-instructions page, `payment_accounts`, server-authoritative `place_order`/`get_order_for_payment` RPCs, accessories-as-products). We **port ours onto main**: most files come over verbatim from `feat/storefront-checkout`; main's parallel cart files are deleted; 6 shared files are hand-reconciled (keep main's UI/display work, swap the cart wiring to our context API).

**Tech Stack:** Next.js 16.2.9 (App Router, Cache Components OFF), React 19, Supabase (Postgres + RLS + Storage), zod 4, Vitest 4.

**Source of truth for ported code:** branch `feat/storefront-checkout` @ `66d7106`. Bring verbatim files with `git checkout feat/storefront-checkout -- <path>`.

## Global Constraints

- **Base is `main`** (this branch `feat/checkout-integration` forked from `origin/main` @ `c320ac0`). Baseline before work: **41 tests / 14 files passing**.
- **NEVER touch main's protected work:** `src/app/admin/staff/*`, `tests/db/staff.test.ts`, the favicon/brand assets (`src/app/{favicon.ico,icon.png,apple-icon.png}`, `scripts/gen-favicon.py`), `src/app/layout.tsx`, `src/app/globals.css`, `src/components/accessory-icon.tsx`. Do not modify or stage these unless a task explicitly says so.
- **Cart UI = ours.** main's cart drawer is dropped. Decisions (owner-confirmed): **free-ship threshold $150**; **volume discount per-line by that line's qty** (qty≥5→0.20, ≥3→0.15, ≥2→0.10); **accessories are real catalog products** (`is_accessory`), priced server-side; **order write path = `place_order` SECURITY DEFINER RPC** (anon never holds service-role).
- **Cache Components OFF** → `unstable_cache` + `revalidateTag`, never `'use cache'`. Public reads use `createPublicClient` (cookieless anon).
- **Our cart-context API** (what consumers wire to): `useCart()` → `{ items: CartItem[], count: number, add(item: CartItem), setQty(sizeId, qty), remove(sizeId), clear(), justAdded: string | null }`. `CartItem = { sizeId, productCode, productName, mg, unitPrice, quantity }`. Build items with `itemFromProduct(product, sizeIdx, qty?)` from `@/lib/cart/cart`.
- **DB tests target LOCAL Supabase** (vitest.config hardcodes local keys). After any schema change: `npm run db:reset && npm run db:types`. The worktree `.env.local` points at local Supabase.
- **Migrations 0008/0009 apply cleanly on main** (main has no migrations past 0007). Bring them verbatim.
- Commit per task with explicit `git add <paths>` — never `git add -A`/`.`.

---

### Task 1: DB layer — migrations 0008 + 0009, RPCs, payment_accounts, DB tests

**Files:**
- Create (verbatim from source): `supabase/migrations/0008_storefront_checkout.sql`, `supabase/migrations/0009_accessories_as_products.sql`
- Create (verbatim): `tests/db/payment-accounts.test.ts`, `tests/db/place-order.test.ts`, `tests/db/get-order-for-payment.test.ts`, `tests/db/accessories.test.ts`
- Modify: `tests/db/seed.test.ts` (scope product/inventory counts to `is_accessory = false`), `src/lib/supabase/database.types.ts` (regenerated)

**Interfaces:**
- Produces: table `public.payment_accounts`; `public.place_order(p_items jsonb, p_customer jsonb, p_payment_method public.payment_method) → jsonb {order_number,total}`; `public.get_order_for_payment(p_order_number text) → table(order_number,total,payment_method,status,payment_status,created_at)`; `products.is_accessory boolean`; 4 seeded accessories; storage bucket `payment-qr`. RPCs granted `execute` to `anon`.

- [ ] **Step 1: Bring the migrations + DB tests verbatim from the source branch**

```bash
git checkout feat/storefront-checkout -- \
  supabase/migrations/0008_storefront_checkout.sql \
  supabase/migrations/0009_accessories_as_products.sql \
  tests/db/payment-accounts.test.ts \
  tests/db/place-order.test.ts \
  tests/db/get-order-for-payment.test.ts \
  tests/db/accessories.test.ts \
  tests/db/seed.test.ts
```

- [ ] **Step 2: Apply + regenerate types**

Run: `npm run db:reset && npm run db:types`
Expected: migrations 0001–0009 apply with no error.

- [ ] **Step 3: Run the DB tests**

Run: `npm test -- payment-accounts place-order get-order-for-payment accessories seed`
Expected: PASS. (`place-order`/`accessories` seed via `execSync('npm run db:seed')` in `beforeAll`; `seed.test` now excludes the 4 accessories from its counts.)

- [ ] **Step 4: Full suite (no regression to main's tests)**

Run: `npm test`
Expected: previous 41 + new DB tests, all green. The staff test still passes (untouched).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0008_storefront_checkout.sql supabase/migrations/0009_accessories_as_products.sql \
  tests/db/payment-accounts.test.ts tests/db/place-order.test.ts tests/db/get-order-for-payment.test.ts \
  tests/db/accessories.test.ts tests/db/seed.test.ts src/lib/supabase/database.types.ts
git commit -m "feat(checkout): DB layer — payment_accounts, place_order/get_order_for_payment RPCs, accessories migration"
```

---

### Task 2: Lib layer — cart helpers, catalog size_id + accessories, payments/orders read+write, products.ts pricing, unit tests

**Files:**
- Create (verbatim): `src/lib/cart/cart.ts`, `src/lib/payments/accounts.ts`, `src/lib/orders/place-order.ts`, `src/lib/orders/place-order-schema.ts`, `src/lib/orders/queries.ts`
- Create (verbatim): `tests/lib/cart.test.ts`, `tests/lib/catalog-size-id.test.ts`, `tests/lib/payment-accounts-read.test.ts`, `tests/lib/place-order-action.test.ts`, `tests/lib/get-order-query.test.ts`
- Modify (verbatim — main did not touch it): `src/lib/catalog/queries.ts`
- Modify (RECONCILE): `src/lib/products.ts`

**Interfaces:**
- Consumes: `volumeDiscount`, `FREE_SHIP_THRESHOLD`, `formatUSD`, `Product`, `SizeOption` from `@/lib/products`; `createPublicClient` from `@/lib/catalog/client`.
- Produces: `cart.ts` (`addItem/setQty/removeItem/clampQty/itemCount/lineTotal/orderTotals/itemFromProduct`, `CartItem`); `getActivePaymentAccounts/getPaymentAccountForMethod`; `placeOrder` action + `placeOrderSchema`/`PlaceOrderState`; `getOrderForPayment`; `getCatalog`/`getAccessories` (size_id threaded).

- [ ] **Step 1: Bring the new lib files + unit tests + catalog queries verbatim**

```bash
git checkout feat/storefront-checkout -- \
  src/lib/cart/cart.ts src/lib/payments/accounts.ts \
  src/lib/orders/place-order.ts src/lib/orders/place-order-schema.ts src/lib/orders/queries.ts \
  src/lib/catalog/queries.ts \
  tests/lib/cart.test.ts tests/lib/catalog-size-id.test.ts tests/lib/payment-accounts-read.test.ts \
  tests/lib/place-order-action.test.ts tests/lib/get-order-query.test.ts
```

- [ ] **Step 2: Reconcile `src/lib/products.ts`**

Start from **main's current `products.ts`** (keep all its catalog/display helpers — `fromPrice`, `priceDisplay`, `sizeDisplay`, `productHref`, `bundleSavings`, `CATEGORIES`, etc. — they are used by main's cards). Apply exactly these edits:

1. Change `export const FREE_SHIP_THRESHOLD = 99;` → `= 150;`
2. Add optional `id` to `SizeOption`:
   ```ts
   export interface SizeOption {
     /** product_sizes.id — present for DB-backed catalog, absent for the static seed fixture. */
     id?: string;
     mg: string;
     price: number;
   }
   ```
3. Verify `volumeDiscount(qty)` returns our per-line spec fractions: qty≥5→0.20, ≥3→0.15, ≥2→0.10, else 0. If main's `VOLUME_TIERS` differ, set them to `[{min:5,off:0.20},{min:3,off:0.15},{min:2,off:0.10}]` so `tests/lib/cart.test.ts` (asserts 10% at qty 2) passes.

Leave main's now-unused cart-engine helpers (`computeCartTotals`, `cartLineFromProduct`, `resolveCartLine`, `cartVolumeDiscount`, `CartTotals`, `FLAT_SHIPPING`, `ACCESSORIES`, `accessoryByCode`, etc.) in place for now — they become dead code once main's cart files are removed in Task 3 and are harmless (a Minor cleanup item for final review). Do not delete them in this task; their consumers are removed in Tasks 3–4.

- [ ] **Step 3: Run the unit tests**

Run: `npm test -- cart catalog-size-id payment-accounts-read place-order-action get-order-query catalog`
Expected: PASS. (`catalog-size-id` seeds in `beforeAll`; asserts threshold 150 + every live size has an id.)

- [ ] **Step 4: Typecheck the lib (no dropped-symbol references)**

Run: `npx tsc --noEmit`
Expected: no errors. (If main's `product-card.tsx`/`product-detail-view.tsx` still import removed symbols, that's fine for now — we did NOT remove any symbol in this task; Task 3/4 rewire those components.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/cart/cart.ts src/lib/payments/accounts.ts src/lib/orders/place-order.ts \
  src/lib/orders/place-order-schema.ts src/lib/orders/queries.ts src/lib/catalog/queries.ts src/lib/products.ts \
  tests/lib/cart.test.ts tests/lib/catalog-size-id.test.ts tests/lib/payment-accounts-read.test.ts \
  tests/lib/place-order-action.test.ts tests/lib/get-order-query.test.ts
git commit -m "feat(checkout): lib layer — cart store, payments/orders, \$150/per-line pricing, size_id + accessories queries"
```

---

### Task 3: Cart context (ours) + drop main's cart files + rewire cart consumers

**Files:**
- Replace (verbatim from source): `src/components/cart-context.tsx`
- Delete (main's cart/checkout): `src/components/cart-drawer.tsx`, `src/components/checkout-view.tsx`, `src/lib/checkout.ts`, `src/app/checkout/actions.ts`, `src/app/checkout/confirmation/page.tsx`
- Modify (RECONCILE — keep main's UI, swap cart wiring): `src/components/site-header.tsx`, `src/components/mobile-cta-bar.tsx`, `src/components/product-card.tsx`

**Interfaces:**
- Consumes: our `useCart()` API (see Global Constraints); `itemFromProduct` from `@/lib/cart/cart`.

- [ ] **Step 1: Replace cart-context with ours; delete main's cart files**

```bash
git checkout feat/storefront-checkout -- src/components/cart-context.tsx
git rm src/components/cart-drawer.tsx src/components/checkout-view.tsx src/lib/checkout.ts \
  src/app/checkout/actions.ts src/app/checkout/confirmation/page.tsx
```

- [ ] **Step 2: Reconcile `src/components/site-header.tsx`**

Keep main's header markup/styling. Change the cart control: replace `const { cart, openCart } = useCart();` with `const { count } = useCart();`, render `count` in the badge, and turn each `<button onClick={openCart}>` cart control into a `<Link href="/cart">` (import `Link` from `next/link`). Remove any `openCart`/drawer references.

- [ ] **Step 3: Reconcile `src/components/mobile-cta-bar.tsx`**

Same swap: `const { count } = useCart();`, render `count`, cart control → `<Link href="/cart">`. Remove `openCart`.

- [ ] **Step 4: Reconcile `src/components/product-card.tsx`**

Keep main's display (the "From $X" lowest-price label + `bundleSavings`). Swap the add-to-cart call: remove the `cartLineFromProduct`/`openCart` usage and import `itemFromProduct` from `@/lib/cart/cart` and `useCart` from `@/components/cart-context`; the add button calls `add(itemFromProduct(product, 0))` (cheapest size). Keep the `justAdded` flash if main has one (use our context's `justAdded`).

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: success. (`/checkout` will still reference deleted files until Task 4 — if build fails ONLY on `src/app/checkout/page.tsx` importing a removed component, that's expected and fixed in Task 4. If so, note it and proceed; otherwise build must pass.)

> Note: main's `src/app/checkout/page.tsx` renders `checkout-view` (now deleted). Task 4 replaces it with ours. If the build can't pass without it, do Task 4's Step for `checkout/page.tsx` here as well before committing — but prefer keeping the commit boundary and accept a known-failing `/checkout` build until Task 4. Decide based on whether `tsc`/build errors are confined to `checkout/page.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/components/cart-context.tsx src/components/site-header.tsx src/components/mobile-cta-bar.tsx src/components/product-card.tsx
git rm --cached src/components/cart-drawer.tsx src/components/checkout-view.tsx src/lib/checkout.ts src/app/checkout/actions.ts src/app/checkout/confirmation/page.tsx 2>/dev/null || true
git commit -m "feat(checkout): our localStorage cart context; drop main's cart drawer; rewire header/cta/card"
```

---

### Task 4: Storefront pages — /cart, /checkout + form, /order pay page, copy-button, product-detail-view, product page

**Files:**
- Create (verbatim): `src/app/cart/page.tsx`, `src/app/checkout/checkout-form.tsx`, `src/app/order/[order_number]/page.tsx`, `src/components/copy-button.tsx`
- Replace (verbatim from source — ours): `src/app/checkout/page.tsx`
- Modify (RECONCILE): `src/components/product-detail-view.tsx`, `src/app/product/[slug]/page.tsx`

**Interfaces:**
- Consumes: `useCart`, `orderTotals`/`lineTotal`/`itemFromProduct` (`@/lib/cart/cart`), `getActivePaymentAccounts`, `placeOrder`/`PlaceOrderState`, `getOrderForPayment`, `getPaymentAccountForMethod`, `getAccessories`.

- [ ] **Step 1: Bring our pages verbatim**

```bash
git checkout feat/storefront-checkout -- \
  src/app/cart/page.tsx src/app/checkout/page.tsx src/app/checkout/checkout-form.tsx \
  src/app/order/[order_number]/page.tsx src/components/copy-button.tsx
```

- [ ] **Step 2: Reconcile `src/app/product/[slug]/page.tsx`**

Keep main's version; add accessories fetch + pass-through:
```tsx
import { getProductBySlug, getRelated, getAccessories } from "@/lib/catalog/queries";
// ...
const [related, accessories] = await Promise.all([getRelated(product), getAccessories()]);
return <ProductDetailView product={product} detail={detail} related={related} accessories={accessories} />;
```
(Match the exact prop/handler names main's `ProductDetailView` already uses; only add `accessories`.)

- [ ] **Step 3: Reconcile `src/components/product-detail-view.tsx`**

Keep main's layout/markup. Three changes: (a) swap cart adds to our API — `useCart()` from our context, add buttons call `add(itemFromProduct(product, sizeIdx, qty))` and related "add all" uses `related.forEach((r) => add(itemFromProduct(r, 0)))`; (b) accept `accessories: Product[]` prop and render the "complete your order" section from it (price via `formatUSD(a.sizes[0].price)`, add via `add(itemFromProduct(a, 0))`), using main's `src/components/accessory-icon.tsx` for icons (map `a.code` → icon kind: BAC-WATER→water, SYRINGES→syringe, SWABS→swab, VIALS→vial); (c) remove imports of any now-removed `@/lib/products` cart symbols (`cartLineFromProduct`, `ACCESSORIES`, `Accessory`) — keep `type AccessoryIcon` only if main's accessory-icon needs it.

- [ ] **Step 4: Verify build + dev runtime**

Run: `npm run build`
Expected: success, routes present: `/cart` (static), `/checkout`, `/order/[order_number]`, `/product/[slug]` (dynamic).
Then start dev and confirm `/checkout` renders with no `"use server"` runtime error (our `place-order.ts` keeps only the async action; the schema lives in `place-order-schema.ts`):
Run: `PORT=3100 npm run dev` (background), then `curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/checkout` → `200`, and confirm the dev log has no `use server` error.

- [ ] **Step 5: Commit**

```bash
git add src/app/cart/page.tsx src/app/checkout/page.tsx src/app/checkout/checkout-form.tsx \
  "src/app/order/[order_number]/page.tsx" src/components/copy-button.tsx \
  src/components/product-detail-view.tsx "src/app/product/[slug]/page.tsx"
git commit -m "feat(checkout): /cart, /checkout+form, /order pay page, copy-button; accessories on PDP from DB"
```

---

### Task 5: Admin payment-accounts area + sections (8th section)

**Files:**
- Modify (RECONCILE): `src/lib/admin/sections.ts` (append `payment-accounts`), `tests/lib/sections.test.ts` (expect 8 slugs)
- Create (verbatim): `src/app/admin/payment-accounts/page.tsx`, `src/app/admin/payment-accounts/actions.ts`, `src/app/admin/payment-accounts/accounts-editor.tsx`, `docs/admin-features/payment-accounts.md`

**Interfaces:**
- Consumes: `requireOwner` (`@/lib/auth/dal`), `createClient` (`@/lib/supabase/server`).

- [ ] **Step 1: Bring the admin area + doc verbatim**

```bash
git checkout feat/storefront-checkout -- \
  "src/app/admin/payment-accounts/page.tsx" "src/app/admin/payment-accounts/actions.ts" \
  "src/app/admin/payment-accounts/accounts-editor.tsx" docs/admin-features/payment-accounts.md
```

- [ ] **Step 2: Reconcile `src/lib/admin/sections.ts`**

Append to `ADMIN_SECTIONS` (main currently has 7 entries ending at `staff`):
```ts
  { slug: 'payment-accounts', label: 'Payment Accounts', table: 'payment_accounts', ownerOnly: true },
```

- [ ] **Step 3: Reconcile `tests/lib/sections.test.ts`**

Update the expected slugs array to the 8: `['dashboard','orders','products','inventory','affiliates','shipping','staff','payment-accounts']`.

- [ ] **Step 4: Verify**

Run: `npm test -- sections && npm run build`
Expected: sections test PASS (8 slugs); build succeeds with route `/admin/payment-accounts` (dynamic). `requireOwner` gates page + action.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/sections.ts tests/lib/sections.test.ts \
  "src/app/admin/payment-accounts/page.tsx" "src/app/admin/payment-accounts/actions.ts" \
  "src/app/admin/payment-accounts/accounts-editor.tsx" docs/admin-features/payment-accounts.md
git commit -m "feat(admin): owner-only payment-accounts editor (8th admin section)"
```

---

### Task 6: Whole-feature verification + E2E

**Files:** none (verification only; fix-forward commits if needed)

- [ ] **Step 1: Clean DB + full suite + lint + build**

Run: `npm run db:reset && npm run db:types && npm test && npm run lint && npm run build`
Expected: all tests green (main's 41 + our checkout tests), lint 0 errors (pre-existing warnings only), build succeeds with `/cart`, `/checkout`, `/order/[order_number]`, `/admin/payment-accounts`, and all of main's routes (incl. `/admin/staff`) present.

- [ ] **Step 2: E2E on localhost**

`PORT=3100 npm run dev`; place a real order via the anon `place_order` RPC (or the UI), confirm `/order/KL-…` shows "Payment Pending — <method>" with the server-computed amount, and that the order is `pending`/`unpaid` in the DB. Delete the test order.

- [ ] **Step 3: Confirm main's work intact**

Verify `/admin/staff` (staff management), the favicon/brand, and product-card "From $X" still work and that `src/app/admin/staff/*`, `globals.css`, favicon assets are byte-identical to `origin/main` (`git diff --stat origin/main -- src/app/admin/staff src/app/globals.css` → empty).

- [ ] **Step 4: Dispatch the final whole-branch review** (per subagent-driven-development) over `origin/main..HEAD`, including the deferred Minor list (e.g. main's dead cart-engine helpers in `products.ts`, copy-button clipboard guard/a11y) for triage.

---

## Self-Review

**Spec coverage:** DB (T1), lib + pricing (T2), cart context + consumers (T3), pages (T4), admin (T5), verification (T6). Every piece of `feat/storefront-checkout` is ported or its consumer reconciled. ✓
**main preserved:** staff/*, favicon, globals.css, layout.tsx, accessory-icon.tsx are never modified (only read for icons); enforced in Global Constraints + T6 Step 3. ✓
**Conflicts resolved:** $150 / per-line / accessories-as-products / place_order RPC, all owner-confirmed; main's `$99`/cart-wide/cart-engine dropped (dead helpers flagged for cleanup). ✓
**Dead-code note:** main's cart-engine functions in `products.ts` are left in place in T2 and become unused after T3–T4; flagged for final-review triage rather than risk an aggressive delete mid-port. ✓
