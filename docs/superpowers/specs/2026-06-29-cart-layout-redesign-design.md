# Cart layout redesign (drawer + page) — design spec

**Date:** 2026-06-29
**Feature:** Rebuild the cart UI to match a reference layout (line-item card,
accessory upsell, promo field, subtotal, free-ship progress, packed-by estimate,
checkout), delivered in BOTH a slide-out drawer and the full `/cart` page from a
single shared component.
**Branch:** `feat/cart-checkout-ui` (worktree `Kairo-Labs-cart-ui`)

## Goal

Port the reference cart layout into our visual language. A shopper clicks the
header cart button → a right-side **drawer** slides over the page showing their
cart in the reference's structure. The drawer has a **"View full cart"** link
that navigates to `/cart`, which renders the **same layout** at page width. One
component owns the layout; the drawer and the page are thin wrappers.

We are matching *layout*, not building new commerce systems. Points/rewards,
shipment protection, and Apple Pay are explicitly **out** (no auth/points system,
no card processor). The only net-new informational feature is a client-side
**packed-by estimate**.

## What exists today (verified in code)

- **Cart state:** `CartProvider` / `useCart()` in
  `src/components/cart-context.tsx` — `CartItem[]` in `localStorage`
  (`kairo-cart-v1`), exposes `items, count, add, setQty, remove, clear,
  justAdded`.
- **Cart model + math:** `src/lib/cart/cart.ts` —
  `CartItem { sizeId, productCode, productName, mg, unitPrice, quantity }`,
  `lineTotal`, `itemCount`, `clampQty`, `addItem/setQty/removeItem`,
  `orderTotals(items) → { subtotal, discount, merch, shipping, total }`
  (shipping = `$9.99` when `0 < merch < FREE_SHIP_THRESHOLD`, else free),
  and `itemFromProduct(p, sizeIdx, qty)`.
- **Threshold + helpers:** `FREE_SHIP_THRESHOLD` (= 150), `formatUSD`,
  `volumeDiscount(qty)` in `src/lib/products.ts`.
- **Accessories:** `ACCESSORIES: Accessory[]` in `src/lib/products.ts`
  (`{ code, name, sub, price, icon }`; Bac Water, Syringes, Swabs, Vials) +
  `accessoryByCode(code)`.
- **Current `/cart` page:** `src/app/cart/page.tsx` — a `"use client"` full-page
  list with inline styles; empty state → "Browse catalog". This file is
  **replaced** by this work.
- **Header entry point:** `src/components/site-header.tsx` (~15–71) — cart button
  is currently a `<Link href="/cart">`. Becomes the drawer trigger.
- **Dormant drawer CSS (reused):** `src/app/globals.css:638–744` — full `.cd-*`
  drawer system already styled: `.cd-root[data-open]` + `.cd-scrim` + `.cd-panel`
  (right slide), `.cd-head`, `.cd-ship`/`.cd-ship-track`/`.cd-ship-fill`,
  `.cd-lines`, `.cd-stepper`, `.cd-nudge`, `.cd-cross*`, `.cd-foot`, `.cd-summary*`.
  Honors `prefers-reduced-motion`. This is the scaffolding the drawer revives.
- **Design tokens:** `:root` in `globals.css` — `--paper/-2`, `--ink/-soft/
  -muted/-ghost`, `--emerald/-bright`, `--forest`, `--hair/-soft`; `font-mono`
  for numerics; `.btn` / `.btn-emerald`.

### What does NOT exist yet (this work builds)

- No reusable cart-contents component (current page is bespoke inline markup).
- No drawer open/close state or trigger (header just links to `/cart`).
- No promo-code field, no accessory upsell in-cart, no packed-by estimate.
- `CartItem` has no `image` and no `kind` field.

## Decisions (settled in brainstorming — do NOT re-open)

1. **Both surfaces, one component.** A shared `<CartContents variant>` renders in
   a `<CartDrawer>` wrapper and on `/cart`. The drawer has a "View full cart"
   link; the page does not.
2. **Drawer revives the `.cd-*` CSS** in `globals.css` — no new drawer styling
   system. New sub-pieces (promo row, packed-by line) get small additions in the
   same `.cd-*` family.
3. **Promo code = visual stub.** Expandable "Add promo code" input; submitting any
   code shows a quiet "No active promo codes" note. No validation backend, no
   discount applied. Clearly cosmetic until real promos exist.
4. **Single-threshold shipping bar.** Restyle to the reference's look but keep our
   real model — one `FREE_SHIP_THRESHOLD` ($150) bar with "Add $X more for free
   shipping". The reference's dual standard/2-day tiers are NOT built (no 2-day
   option exists).
5. **Accessories are plain cart lines** with a `kind` flag, not a new cart API.
   `CartItem` gains `kind?: "product" | "accessory"` (default `"product"`) and
   optional `image?: string`. Accessory lines: hide the `mg` dose subtitle (show
   `accessory.sub` instead) and are **excluded from `volumeDiscount`**.
6. **Out of scope:** points/rewards banner, shipment-protection row, Apple Pay.

## Architecture

```
site-header (cart button) ──opens──▶ CartDrawer ──renders──▶ CartContents variant="drawer"
                                                                     │
/cart/page.tsx ─────────────────────────────────render──────────────┴─▶ CartContents variant="page"
                                                                     │
                                              useCart() + orderTotals()/packEstimate()
```

### Components & files

- **`src/components/cart-contents.tsx`** (new) — `<CartContents variant>`. The
  whole layout. Reads `useCart()`. Pure presentational + cart mutations; no data
  fetching. Sections render in order (below). `variant` toggles: sticky footer +
  "View full cart" link (drawer) vs. wider `max-width`, no link (page).
- **`src/components/cart-drawer.tsx`** (new) — `<CartDrawer>`. Renders
  `.cd-root`/`.cd-scrim`/`.cd-panel`, header "Cart (N)" + close X, mounts
  `<CartContents variant="drawer">`. Reads open state from context (below).
  Closes on scrim click, X, Esc, and route change.
- **`src/components/cart-context.tsx`** (edit) — add UI state:
  `drawerOpen: boolean`, `openDrawer()`, `closeDrawer()`. (Auto-open on `add` is
  **not** done now — preserves the existing "Added ✓" affordance; noted as a
  later option.)
- **`src/components/site-header.tsx`** (edit) — cart `<Link href="/cart">`
  becomes a `<button onClick={openDrawer}>` (same icon/count). `/cart` remains
  reachable directly and via "View full cart".
- **`src/app/cart/page.tsx`** (replace) — render `<CartContents variant="page">`
  inside the existing `main.container`; keep the empty-state → "Browse catalog".
- **`src/app/layout` / provider tree** — mount `<CartDrawer />` once near the
  root (inside `CartProvider`) so it overlays any page.
- **`src/lib/cart/cart.ts`** (edit) — extend `CartItem` with `kind?` and
  `image?`; `orderTotals`/`volumeDiscount` skip discount on `kind==="accessory"`;
  `itemFromProduct` sets `kind:"product"` and `image` from the product (fallback
  undefined). Add `accessoryToCartItem(a: Accessory): CartItem`
  (`sizeId/productCode = a.code`, `productName = a.name`, `mg = ""`,
  `unitPrice = a.price`, `kind:"accessory"`).
- **`src/lib/cart/pack-estimate.ts`** (new) — `packEstimate(now: Date): string`.
  Pure function (date passed in for testability). Rule: pack window = today
  through **+2 business days**, skipping Sat/Sun; if `now`'s local hour ≥ 14
  (2pm cutoff), start from the next business day. Returns
  `"Today – {Weekday, Mon D}"` (or just the end date if start ≠ today).

### Layout sections (top → bottom)

Rendered by `<CartContents>`; reference structure in our tokens.

1. **Header** — "Cart (N)" + close X. *Drawer only* (`.cd-head`); the page uses
   its own `h1`.
2. **Line items** (`.cd-lines`) — per item: product image (`image` or neutral
   vial placeholder), name, **dose subtitle** (`mg` for products / `sub` for
   accessories), **qty stepper** (`.cd-stepper`: − N + → `setQty`), line total
   right-aligned, remove X (`remove`). Card surface `--paper-2`, `--hair` border.
3. **Accessory upsell** (`.cd-nudge` / `.cd-cross`) — "Don't forget {accessory}"
   for accessories **not already in cart** (from `ACCESSORIES`), each with
   `+ Add` → `add(accessoryToCartItem(a))`. Show up to 1–3.
4. **Add promo code** — tag icon + expandable input (stub per Decision 3).
5. **Subtotal block** (`.cd-summary`) — Subtotal; Volume discount (when > 0);
   Shipping (FREE / `$X`); from `orderTotals()`. Total row emphasized.
6. **Free-shipping progress** (`.cd-ship`) — single bar to `FREE_SHIP_THRESHOLD`
   on `merch`; "Add $X more for free shipping" or a free-shipping confirmation.
7. **Packed-by estimate** — "✓ Estimated to be packed {packEstimate(new Date())}".
8. **Footer** (`.cd-foot`) — **Proceed to Checkout** → `/checkout`
   (`.btn-emerald`). *Drawer only:* secondary **"View full cart"** link → `/cart`
   (closes drawer). Empty cart: "Your cart is empty" + "Browse catalog".

## Data flow

- Reads/mutations all go through `useCart()`; no server calls. Totals from
  `orderTotals(items)`; remaining-to-free from `FREE_SHIP_THRESHOLD - merch`.
- Drawer visibility from `drawerOpen` in context; `openDrawer` (header),
  `closeDrawer` (X / scrim / Esc / "View full cart").
- Accessory adds reuse `add()` (dedup/clamp already handled by `addItem`).

## Error / edge handling

- **Empty cart** in both variants → empty state, no footer totals.
- **Legacy localStorage carts** lack `image`/`kind` → `image` undefined falls
  back to placeholder; `kind` undefined treated as `"product"`.
- **Qty stepper** clamps via `clampQty` (1–99); decrement at 1 → remove (existing
  `setQty(...,0)` path removes).
- **Body scroll lock** while drawer open; restore on close. Respect
  `prefers-reduced-motion` (already in `.cd-*` CSS).
- **Promo stub** never errors — any input yields the "No active promo codes"
  note; no state leaks into totals.

## Testing

- **Unit (Vitest):**
  - `pack-estimate.ts` — fixed input dates: before/after 2pm cutoff, Fri→skip
    weekend, mid-week; assert exact label strings.
  - `cart.ts` — `orderTotals` excludes discount for `kind:"accessory"` lines;
    `accessoryToCartItem` shape; `itemFromProduct` sets `kind`/`image`.
- **Component/manual:** drawer open/close (button, X, scrim, Esc, route change);
  qty stepper +/−/remove; accessory `+ Add` moves item into list and out of
  upsell; progress bar fills and message flips at threshold; "View full cart"
  navigates and closes; page and drawer render identical sections.

## Out of scope

Points/rewards, shipment protection, Apple Pay/alt-pay, real promo validation,
2-day shipping tier, adopting the unused `computeCartTotals`/`CartLineInput` API.
