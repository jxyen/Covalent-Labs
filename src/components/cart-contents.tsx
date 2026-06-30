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
