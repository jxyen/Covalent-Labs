# Cart Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the cart UI to match the reference layout (line-item card with qty stepper, accessory cross-sell, promo-code field, subtotal, free-ship progress, packed-by estimate, checkout) delivered in BOTH a slide-out drawer and the full `/cart` page from one shared component.

**Architecture:** A shared client component `<CartContents variant="drawer"|"page">` owns the whole layout and reads the existing `useCart()` localStorage context. `<CartDrawer>` wraps it in the dormant `.cd-*` drawer shell (already styled in `globals.css`); `/cart/page.tsx` renders it at page width. The header/CTA cart buttons open the drawer via new `drawerOpen`/`openCart`/`closeCart` state added to the cart context. Accessory cross-sell uses DB accessory `Product`s (passed as props, fetched server-side via `getAccessories()`) and adds them with the same `itemFromProduct(a, 0)` call the PDP already uses.

**Tech Stack:** Next.js 16 (App Router, fork — see `node_modules/next/dist/docs/`), React 19, TypeScript, Vitest (node env), Tailwind v4 + CSS custom properties.

## Global Constraints

- This is a forked Next.js — read `node_modules/next/dist/docs/` before using any Next API you're unsure of (per `AGENTS.md`). No new route handlers are added here.
- `'use server'` files export async functions ONLY (fork runtime throws otherwise) — N/A here, but do not add server actions to client files.
- Money is rendered with `formatUSD` from `@/lib/products`; numerics use the `font-mono` class. Use existing tokens (`--paper`, `--paper-2`, `--ink`, `--ink-soft`, `--ink-muted`, `--ink-ghost`, `--ink-faint`, `--emerald`, `--emerald-bright`, `--emerald-soft`, `--emerald-line`, `--forest`, `--hair`, `--hair-soft`, `--surface-card`). Do NOT invent new colors.
- Reuse the existing `.cd-*` CSS in `src/app/globals.css:638-744` — do NOT write a new drawer styling system. Small additive classes for the promo row / packed-by line are fine in the same family.
- Cart state stays the current localStorage `CartItem` model (`@/lib/cart/cart`) + `orderTotals`. Do NOT adopt the unused `computeCartTotals`/`CartLineInput` API.
- Server is authoritative for money (`place_order` RPC). The client total must mirror current behavior — do NOT change `orderTotals`/`volumeDiscount` math.
- Tests run on LOCAL Supabase via `npm test` (`vitest run`), node environment. Only pure-function logic gets unit tests; UI is verified via lint + typecheck + the running dev server on `:3001`.
- Out of scope (do NOT build): points/rewards banner, shipment-protection row, Apple Pay, real promo validation, 2-day shipping tier.

---

### Task 1: Packed-by estimate utility

**Files:**
- Create: `src/lib/cart/pack-estimate.ts`
- Test: `tests/lib/pack-estimate.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `packEstimate(now: Date): string` — a label like `"Today – Wed, Jul 1"` or `"Tue, Jun 30 – Thu, Jul 2"`. Rule: orders placed before 2pm **local** on a business day pack "today"; at/after 2pm (or on a weekend) packing starts the next business day; the window end is **2 business days** after the start. Weekends (Sat/Sun) are skipped.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/pack-estimate.test.ts
import { describe, it, expect } from 'vitest'
import { packEstimate } from '../../src/lib/cart/pack-estimate'

describe('packEstimate', () => {
  it('before 2pm on a weekday packs today, +2 business days end', () => {
    // Mon Jun 29 2026, 10:00 local
    expect(packEstimate(new Date(2026, 5, 29, 10))).toBe('Today – Wed, Jul 1')
  })
  it('at/after 2pm starts the next business day', () => {
    // Mon Jun 29 2026, 15:00 local -> start Tue Jun 30, end Thu Jul 2
    expect(packEstimate(new Date(2026, 5, 29, 15))).toBe('Tue, Jun 30 – Thu, Jul 2')
  })
  it('skips the weekend when counting from a Friday', () => {
    // Fri Jul 3 2026, 10:00 -> today, +2 biz days (skip Sat/Sun) -> Tue Jul 7
    expect(packEstimate(new Date(2026, 6, 3, 10))).toBe('Today – Tue, Jul 7')
  })
  it('advances a weekend order to Monday start', () => {
    // Sat Jul 4 2026, 10:00 -> start Mon Jul 6, end Wed Jul 8
    expect(packEstimate(new Date(2026, 6, 4, 10))).toBe('Mon, Jul 6 – Wed, Jul 8')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- pack-estimate`
Expected: FAIL — cannot find module `pack-estimate`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/cart/pack-estimate.ts
const CUTOFF_HOUR = 14 // 2pm local
const WINDOW_BUSINESS_DAYS = 2

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function nextBusinessDay(d: Date): Date {
  let r = new Date(d)
  while (isWeekend(r)) r = addDays(r, 1)
  return r
}

function addBusinessDays(d: Date, n: number): Date {
  let r = new Date(d)
  let added = 0
  while (added < n) {
    r = addDays(r, 1)
    if (!isWeekend(r)) added++
  }
  return r
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const fmt = (d: Date) =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

/**
 * Human "estimated to be packed" window. Orders before 2pm on a business day
 * pack today; later/weekend orders start the next business day. Window end is
 * 2 business days out. Pure: pass the current Date so it's testable.
 */
export function packEstimate(now: Date): string {
  let start = new Date(now)
  if (start.getHours() >= CUTOFF_HOUR) start = addDays(start, 1)
  start = nextBusinessDay(start)
  const end = addBusinessDays(start, WINDOW_BUSINESS_DAYS)
  const startLabel = sameDay(start, now) ? 'Today' : fmt(start)
  return `${startLabel} – ${fmt(end)}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- pack-estimate`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cart/pack-estimate.ts tests/lib/pack-estimate.test.ts
git commit -m "feat(cart): packed-by estimate utility"
```

---

### Task 2: Cart model — line image + drawer UI state

**Files:**
- Modify: `src/lib/cart/cart.ts` (CartItem interface + `itemFromProduct`)
- Modify: `src/components/cart-context.tsx` (add drawer open state)
- Test: `tests/lib/cart.test.ts` (add one case)

**Interfaces:**
- Consumes: `Product` from `@/lib/products` (has `image: string`, `sizes: SizeOption[]`).
- Produces:
  - `CartItem` gains `image?: string | null`.
  - `itemFromProduct(p, sizeIdx, quantity?)` now sets `image: p.image`.
  - `useCart()` value gains `drawerOpen: boolean`, `openCart(): void`, `closeCart(): void`.

- [ ] **Step 1: Write the failing test**

Add to `tests/lib/cart.test.ts` (inside the `describe('cart', …)` block):

```ts
  it('itemFromProduct snapshots the product image onto the line', () => {
    const product = {
      code: 'GLP3', name: 'GLP-3 (RT)', sub: '', category: 'x', image: '/img/glp3.png',
      mechanism: '', tagline: '', purity: '', rating: 0, reviews: 0,
      bestseller: false, featured: false, blurb: '',
      sizes: [{ id: 's1', mg: '10 mg', price: 69.99 }],
    } as unknown as import('../../src/lib/products').Product
    const line = itemFromProduct(product, 0)
    expect(line.image).toBe('/img/glp3.png')
    expect(line.sizeId).toBe('s1')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/cart.test.ts`
Expected: FAIL — `line.image` is `undefined` (property not set yet).

- [ ] **Step 3a: Add `image` to the CartItem model**

In `src/lib/cart/cart.ts`, extend the interface and `itemFromProduct`:

```ts
export interface CartItem {
  sizeId: string
  productCode: string
  productName: string
  mg: string
  unitPrice: number
  quantity: number
  image?: string | null
}
```

```ts
export function itemFromProduct(p: Product, sizeIdx: number, quantity = 1): CartItem {
  const s = p.sizes[sizeIdx]
  if (!s?.id) throw new Error(`size ${sizeIdx} of ${p.code} has no id`)
  return { sizeId: s.id, productCode: p.code, productName: p.name, mg: s.mg, unitPrice: s.price, quantity, image: p.image }
}
```

- [ ] **Step 3b: Add drawer open/close state to the cart context**

In `src/components/cart-context.tsx`:

Add to the `CartContextValue` interface:

```ts
  drawerOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
```

Inside `CartProvider`, after the existing `useState`/`useRef` declarations, add state and callbacks:

```ts
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openCart = useCallback(() => setDrawerOpen(true), []);
  const closeCart = useCallback(() => setDrawerOpen(false), []);
```

Then extend the memoized `value` (keep existing fields, add the three new ones and `drawerOpen` to the dependency array):

```ts
  const value = useMemo(
    () => ({ items, count: itemCount(items), add, setQty, remove, clear, justAdded, drawerOpen, openCart, closeCart }),
    [items, add, setQty, remove, clear, justAdded, drawerOpen, openCart, closeCart],
  );
```

- [ ] **Step 4: Run test + typecheck to verify**

Run: `npm test -- tests/lib/cart.test.ts && npx tsc --noEmit`
Expected: cart tests PASS; tsc reports no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cart/cart.ts src/components/cart-context.tsx tests/lib/cart.test.ts
git commit -m "feat(cart): line image snapshot + drawer open/close state"
```

---

### Task 3: Shared `<CartContents>` component + rewire `/cart` page

**Files:**
- Create: `src/components/cart-contents.tsx`
- Create: `src/components/promo-code.tsx`
- Modify: `src/app/cart/page.tsx` (replace with server component rendering `<CartContents>`)

**Interfaces:**
- Consumes: `useCart()` (`items, setQty, remove, add, closeCart`), `orderTotals`/`lineTotal` from `@/lib/cart/cart`, `FREE_SHIP_THRESHOLD`/`formatUSD`/`nextVolumeTier`/`accessoryByCode`/`itemFromProduct`/`Product` from `@/lib/products` & `@/lib/cart/cart`, `AccIcon` from `@/components/accessory-icon`, `packEstimate` from `@/lib/cart/pack-estimate`, `getAccessories` from `@/lib/catalog/queries`.
- Produces:
  - `<CartContents variant="drawer" | "page" accessories={Product[]} />` — full cart layout.
  - `<PromoCode />` — self-contained promo-code stub.

- [ ] **Step 1: Create the promo-code stub**

```tsx
// src/components/promo-code.tsx
"use client";

import { useState } from "react";

/**
 * Promo-code entry — visual stub. No codes are wired yet, so submitting any
 * value shows a quiet "no active codes" note and nothing is applied to totals.
 */
export function PromoCode() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  if (!open) {
    return (
      <button className="cd-promo-toggle" onClick={() => setOpen(true)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.4 7.4a2 2 0 0 1 0 2.4z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>
        Add promo code
      </button>
    );
  }

  return (
    <form
      className="cd-promo"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(code.trim() ? "No active promo codes right now." : "");
      }}
    >
      <input
        className="cd-promo-input font-mono"
        placeholder="Promo code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoFocus
      />
      <button type="submit" className="cd-promo-apply">Apply</button>
      {msg && <p className="cd-promo-msg">{msg}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Add the small promo/packed-by styles**

Append to `src/app/globals.css` (after the `.cd-rou` rule, before the `@media (prefers-reduced-motion …)` block — keep the media query last):

```css
.cd-promo-toggle { display: flex; align-items: center; gap: 9px; width: 100%; padding: 14px 20px; border: none; border-top: 1px solid var(--hair-soft); border-bottom: 1px solid var(--hair-soft); background: none; cursor: pointer; font-size: 13.5px; font-weight: 600; color: var(--ink-soft); }
.cd-promo-toggle:hover { color: var(--ink); }
.cd-promo { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--hair-soft); border-bottom: 1px solid var(--hair-soft); }
.cd-promo-input { flex: 1; min-width: 0; padding: 9px 12px; border: 1px solid var(--hair); border-radius: 9px; background: var(--surface-card); font-size: 13px; }
.cd-promo-apply { flex: none; padding: 9px 16px; border: 1px solid var(--emerald-line); border-radius: 9px; background: var(--emerald-soft); color: var(--forest); font-size: 13px; font-weight: 600; cursor: pointer; }
.cd-promo-msg { flex-basis: 100%; margin: 2px 0 0; font-size: 12px; color: var(--ink-muted); }
.cd-pack { display: flex; align-items: center; gap: 8px; padding: 12px 20px 0; font-size: 12.5px; color: var(--ink-soft); }
.cd-pack b { color: var(--ink); font-weight: 600; }
.cd-pack svg { color: var(--emerald); flex: none; }
.cd-viewcart { width: 100%; margin-top: 10px; background: none; border: none; cursor: pointer; font-size: 13px; color: var(--ink-muted); text-decoration: underline; display: inline-block; text-align: center; }
.cd-viewcart:hover { color: var(--ink); }
/* page variant: same content, not a fixed panel */
.cart-page .cd-foot { position: static; border-radius: 14px; border: 1px solid var(--hair); margin-top: 18px; }
.cart-page .cd-scroll { overflow: visible; }
```

- [ ] **Step 3: Create the shared CartContents component**

```tsx
// src/components/cart-contents.tsx
"use client";

import Link from "next/link";
import { useCart } from "@/components/cart-context";
import { AccIcon } from "@/components/accessory-icon";
import { PromoCode } from "@/components/promo-code";
import { orderTotals, lineTotal, itemFromProduct, type CartItem } from "@/lib/cart/cart";
import {
  FREE_SHIP_THRESHOLD,
  formatUSD,
  nextVolumeTier,
  accessoryByCode,
  type Product,
} from "@/lib/products";
import { packEstimate } from "@/lib/cart/pack-estimate";

const CartIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1.3" /><circle cx="18" cy="20" r="1.3" /><path d="M2 3h3l2.4 12.4a1.5 1.5 0 0 0 1.5 1.2h8.1a1.5 1.5 0 0 0 1.5-1.2L22 7H6" /></svg>
);
const Check = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);

export function CartContents({ variant, accessories }: { variant: "drawer" | "page"; accessories: Product[] }) {
  const { items, setQty, remove, add, closeCart } = useCart();
  const t = orderTotals(items);

  const accByCode = new Map(accessories.map((a) => [a.code, a]));
  const isAccessory = (code: string) => accByCode.has(code);

  if (items.length === 0) {
    return (
      <div className="cd-empty">
        <div className="cd-empty-ic"><CartIcon /></div>
        <p>Your cart is empty.</p>
        <Link href="/catalog" className="btn btn-emerald" style={{ padding: "12px 22px", fontSize: 14.5 }} onClick={variant === "drawer" ? closeCart : undefined}>
          Browse the catalog
        </Link>
      </div>
    );
  }

  const remaining = Math.max(0, FREE_SHIP_THRESHOLD - t.merch);
  const freeShipPct = Math.min(100, Math.round((t.merch / FREE_SHIP_THRESHOLD) * 100));
  const productUnits = items.filter((x) => !isAccessory(x.productCode)).reduce((n, x) => n + x.quantity, 0);
  const nextTier = nextVolumeTier(productUnits);
  const inCart = new Set(items.map((x) => x.productCode));
  const crossSell = accessories.filter((a) => !inCart.has(a.code)).slice(0, 3);

  const lineSub = (x: CartItem) => (isAccessory(x.productCode) ? accByCode.get(x.productCode)?.sub ?? x.mg : x.mg);
  const lineIcon = (x: CartItem) => accessoryByCode(x.productCode)?.icon ?? "vial";

  return (
    <>
      {/* free-shipping progress */}
      <div className="cd-ship">
        <div className="cd-ship-msg">
          {remaining > 0 ? (
            <>Add <b>{formatUSD(remaining)}</b> more for <b>free US shipping</b></>
          ) : (
            <><b>✓ Your order ships free.</b></>
          )}
        </div>
        <div className="cd-ship-track"><div className="cd-ship-fill" style={{ width: `${freeShipPct}%` }} /></div>
      </div>

      <div className="cd-scroll">
        {/* line items */}
        <div className="cd-lines">
          {items.map((x) => {
            const acc = isAccessory(x.productCode);
            return (
              <div className="cd-line" key={x.sizeId}>
                <div className="cd-thumb" data-kind={acc ? "accessory" : "product"}>
                  {x.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={x.image} alt="" />
                  ) : (
                    <span className="cd-thumb-ic">{acc && <AccIcon kind={lineIcon(x)} size={22} />}</span>
                  )}
                </div>
                <div className="cd-line-main">
                  <div className="cd-line-name">{x.productName}</div>
                  <div className="cd-line-sub font-mono">{lineSub(x)}</div>
                  <div className="cd-line-controls">
                    <div className="cd-stepper">
                      <button aria-label="Decrease quantity" onClick={() => setQty(x.sizeId, x.quantity - 1)}>−</button>
                      <span>{x.quantity}</span>
                      <button aria-label="Increase quantity" onClick={() => setQty(x.sizeId, x.quantity + 1)}>+</button>
                    </div>
                    <button className="cd-remove" onClick={() => remove(x.sizeId)}>Remove</button>
                  </div>
                </div>
                <div className="cd-line-price">{formatUSD(lineTotal(x))}</div>
              </div>
            );
          })}
        </div>

        {/* volume upsell nudge */}
        {nextTier && (
          <div className="cd-nudge">
            Add <b>{nextTier.need}</b> more {nextTier.need === 1 ? "vial" : "vials"} → save <b>{Math.round(nextTier.off * 100)}%</b> on all peptides
          </div>
        )}

        {/* accessory cross-sell */}
        {crossSell.length > 0 && (
          <div className="cd-cross">
            <div className="cd-cross-h">Don&apos;t forget</div>
            {crossSell.map((a) => (
              <div className="cd-cross-item" key={a.code}>
                <span className="cd-cross-ic"><AccIcon kind={accessoryByCode(a.code)?.icon ?? "vial"} size={18} /></span>
                <div className="cd-cross-meta">
                  <div className="nm">{a.name}</div>
                  <div className="sb font-mono">{a.sub}</div>
                </div>
                <button className="cd-cross-add" onClick={() => add(itemFromProduct(a, 0))}>
                  {formatUSD(a.sizes[0].price)} · Add
                </button>
              </div>
            ))}
          </div>
        )}

        <PromoCode />

        {/* packed-by estimate */}
        <div className="cd-pack">
          <Check /> Estimated to be packed <b>{packEstimate(new Date())}</b>
        </div>
      </div>

      {/* summary + checkout */}
      <footer className="cd-foot">
        <dl className="cd-summary">
          <div><dt>Subtotal</dt><dd>{formatUSD(t.subtotal)}</dd></div>
          {t.discount > 0 && (
            <div className="cd-summary-disc"><dt>Volume discount</dt><dd>−{formatUSD(t.discount)}</dd></div>
          )}
          <div><dt>Shipping</dt><dd>{t.shipping === 0 ? "Free" : formatUSD(t.shipping)}</dd></div>
          <div className="cd-summary-total"><dt>Total</dt><dd>{formatUSD(t.total)}</dd></div>
        </dl>
        <Link href="/checkout" className="btn btn-emerald cd-checkout" onClick={variant === "drawer" ? closeCart : undefined}>
          Proceed to Checkout →
        </Link>
        {variant === "drawer" && (
          <Link href="/cart" className="cd-viewcart" onClick={closeCart}>View full cart</Link>
        )}
        <p className="cd-rou font-mono">For research use only · not for human or animal consumption</p>
      </footer>
    </>
  );
}
```

- [ ] **Step 4: Replace the `/cart` page with a server component**

```tsx
// src/app/cart/page.tsx
import { getAccessories } from "@/lib/catalog/queries";
import { CartContents } from "@/components/cart-contents";

export default async function CartPage() {
  const accessories = await getAccessories();
  return (
    <main className="container cart-page" style={{ padding: "32px 20px 80px", maxWidth: 720 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Your cart</h1>
      <CartContents variant="page" accessories={accessories} />
    </main>
  );
}
```

- [ ] **Step 5: Verify lint + typecheck + page render**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors; lint clean.

Then with the dev server on `:3001`: add an item to the cart from a product page, visit `http://localhost:3001/cart`, and confirm the new layout renders — line-item card with `−/+` stepper and Remove, free-ship progress bar, "Don't forget" cross-sell, "Add promo code" toggle, "Estimated to be packed …" line, and the Subtotal/Total summary with "Proceed to Checkout". Empty the cart and confirm the empty state shows.

- [ ] **Step 6: Commit**

```bash
git add src/components/cart-contents.tsx src/components/promo-code.tsx src/app/cart/page.tsx src/app/globals.css
git commit -m "feat(cart): shared CartContents layout + promo stub + packed-by; rewire /cart page"
```

---

### Task 4: Slide-out drawer + open triggers

**Files:**
- Create: `src/components/cart-drawer.tsx`
- Modify: `src/app/layout.tsx` (fetch accessories, mount `<CartDrawer>`)
- Modify: `src/components/site-header.tsx` (cart Links → buttons that `openCart`)
- Modify: `src/components/mobile-cta-bar.tsx` (cart Link → button that `openCart`)

**Interfaces:**
- Consumes: `useCart()` (`drawerOpen`, `closeCart`, `count`), `<CartContents>`, `Product[]` accessories, `usePathname` from `next/navigation`.
- Produces: `<CartDrawer accessories={Product[]} />` — the slide-out shell rendering `<CartContents variant="drawer">`.

- [ ] **Step 1: Create the drawer wrapper**

```tsx
// src/components/cart-drawer.tsx
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart-context";
import { CartContents } from "@/components/cart-contents";
import type { Product } from "@/lib/products";

export function CartDrawer({ accessories }: { accessories: Product[] }) {
  const { drawerOpen, closeCart, count } = useCart();
  const pathname = usePathname();

  // Close the drawer on navigation (e.g. after "View full cart" / Checkout).
  useEffect(() => {
    closeCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeCart(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen, closeCart]);

  return (
    <div className="cd-root" data-open={drawerOpen} aria-hidden={!drawerOpen}>
      <button className="cd-scrim" aria-label="Close cart" onClick={closeCart} tabIndex={drawerOpen ? 0 : -1} />
      <aside className="cd-panel" role="dialog" aria-label="Shopping cart" aria-modal="true">
        <header className="cd-head">
          <div className="cd-title">
            Cart {count > 0 && <span className="cd-count font-mono">{count}</span>}
          </div>
          <button className="cd-x" aria-label="Close cart" onClick={closeCart}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <CartContents variant="drawer" accessories={accessories} />
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Mount the drawer in the root layout**

In `src/app/layout.tsx`: add imports, make the component async, fetch accessories, and render `<CartDrawer>` inside `<CartProvider>` (after `<MobileCtaBar />`).

```tsx
import { getAccessories } from "@/lib/catalog/queries";
import { CartDrawer } from "@/components/cart-drawer";
```

```tsx
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const accessories = await getAccessories();
```

Inside `<CartProvider>`, after `<MobileCtaBar />`:

```tsx
          <MobileCtaBar />
          <CartDrawer accessories={accessories} />
```

- [ ] **Step 3: Rewire the header cart buttons**

In `src/components/site-header.tsx`:

Replace `const { count } = useCart();` with:

```tsx
  const { count, openCart } = useCart();
```

Replace BOTH cart `<Link href="/cart" aria-label="View cart" …>…</Link>` blocks (the `show-desktop` one and the `show-mobile` one) — swap the `<Link href="/cart">` element for a `<button type="button" onClick={openCart}>` keeping the identical `aria-label`, inline `style`, `<CartIcon />`, and `<CartBadge count={count} />`. Example (desktop):

```tsx
          <button type="button" onClick={openCart} aria-label="View cart" style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, border: "1px solid var(--hair)", background: "none", cursor: "pointer", color: "var(--ink)" }}>
            <CartIcon />
            <CartBadge count={count} />
          </button>
```

Apply the same swap to the `show-mobile` cart link (keep its `width: 40, height: 40` style). If `Link` is no longer used elsewhere in the file, leave the import (the nav links still use it).

- [ ] **Step 4: Rewire the mobile CTA bar cart button**

In `src/components/mobile-cta-bar.tsx`:

Replace `const { count } = useCart();` with `const { count, openCart } = useCart();`.

Swap the cart `<Link href="/cart" … className="mcta-cart" …>…</Link>` for a button, preserving class/style/contents:

```tsx
        <button type="button" onClick={openCart} aria-label="View cart" className="mcta-cart" style={{ color: "var(--ink)", background: "none", cursor: "pointer", border: "none" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="20" r="1.3" />
            <circle cx="18" cy="20" r="1.3" />
            <path d="M2 3h3l2.4 12.4a1.5 1.5 0 0 0 1.5 1.2h8.1a1.5 1.5 0 0 0 1.5-1.2L22 7H6" />
          </svg>
          {count > 0 && <span className="mcta-badge font-mono">{count}</span>}
        </button>
```

The `Shop the catalog →` `<Link>` stays, so the `Link` import remains.

- [ ] **Step 5: Verify lint + typecheck + drawer behavior**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors; lint clean.

With the dev server on `:3001`: click the header cart icon → the drawer slides in from the right showing the same layout as the page. Confirm: Esc / scrim click / the X all close it; "View full cart" navigates to `/cart` and closes the drawer; "Proceed to Checkout" navigates to `/checkout` and closes it; body scroll is locked while open; the mobile CTA bar cart icon also opens the drawer.

- [ ] **Step 6: Commit**

```bash
git add src/components/cart-drawer.tsx src/app/layout.tsx src/components/site-header.tsx src/components/mobile-cta-bar.tsx
git commit -m "feat(cart): slide-out drawer + header/cta open triggers"
```

---

## Self-Review

**Spec coverage:**
- Shared component in both drawer + page → Tasks 3 & 4. ✓
- Drawer revives `.cd-*` CSS → Task 4 uses `.cd-root/.cd-panel/.cd-head`; Task 3 reuses `.cd-ship/.cd-lines/.cd-foot` etc. ✓
- Line-item card + qty stepper + remove + image → Tasks 2 & 3. ✓
- Accessory upsell ("Don't forget") → Task 3 cross-sell (DB accessories, `itemFromProduct`). ✓
- Promo stub → Task 3 `<PromoCode>`. ✓
- Single-threshold free-ship bar → Task 3 (`FREE_SHIP_THRESHOLD`, `t.merch`). ✓
- Subtotal/discount/shipping/total summary → Task 3 footer. ✓
- Packed-by estimate → Task 1 util, rendered in Task 3. ✓
- "View full cart" (drawer) → Task 3 footer. ✓
- Header/CTA open the drawer → Task 4. ✓
- Empty state both variants → Task 3 `cd-empty`. ✓

**Spec deviations (intentional, from planning discovery):**
- The spec's `kind` field on `CartItem` and accessory discount-exclusion are **dropped**. Accessories are already DB `Product`s added via `itemFromProduct` (the PDP does this today); excluding them from `volumeDiscount` would diverge from the authoritative server `place_order` total. Accessories are instead detected by code against the passed `accessories` list (display only). `orderTotals`/`volumeDiscount` math is unchanged.

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows full content. ✓

**Type consistency:** `openCart`/`closeCart`/`drawerOpen` defined in Task 2, consumed in Tasks 3–4. `CartItem.image` defined Task 2, used Task 3. `packEstimate(now: Date): string` defined Task 1, used Task 3. `CartContents` props `{ variant, accessories }` consistent across Tasks 3–4. `getAccessories(): Promise<Product[]>` used in Tasks 3–4. ✓

## Manual verification checklist (after all tasks)

- `npm test` green (pack-estimate + cart suites).
- `npx tsc --noEmit` and `npm run lint` clean.
- Drawer: opens from header + mobile CTA; closes via X/scrim/Esc/navigation; body scroll locked.
- Page `/cart`: identical sections at page width; "View full cart" absent (drawer-only).
- Stepper +/−, Remove, cross-sell Add all mutate the cart and reflect in both surfaces.
- Free-ship bar fills and message flips at $150; packed-by line reads sensibly for the current day.
