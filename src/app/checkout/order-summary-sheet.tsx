"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart-context";
import { orderTotals } from "@/lib/cart/cart";
import { formatUSD } from "@/lib/products";
import { deliveryById } from "./delivery-options";
import { ChevronUp } from "./checkout-icons";
import { OrderSummary } from "./order-summary";

/**
 * Mobile-only order summary: a fixed bottom bar (count + total + chevron) that
 * expands a bottom sheet with the full summary. Mirrors the cart drawer's scrim /
 * scroll-lock / Escape / inert behavior, anchored to the bottom.
 */
export function OrderSummarySheet({ delivery, atReview = false }: { delivery: string; atReview?: boolean }) {
  const { items, count } = useCart();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const t = orderTotals(items);
  const total = Math.round((t.merch + deliveryById(delivery).price) * 100) / 100;

  // The sheet can never be open while the bar is dismissed (review step).
  const sheetOpen = open && !atReview;

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  return (
    <div className="co-sheet-wrap">
      <button className="co-sheet-bar" type="button" data-hidden={atReview} onClick={() => setOpen(true)} aria-expanded={sheetOpen} aria-hidden={atReview} tabIndex={atReview ? -1 : 0}>
        <span className="co-sheet-bar-left">
          <span className="co-sheet-count">{count}</span>
          <span className="co-sheet-label">item{count === 1 ? "" : "s"}</span>
          <ChevronUp size={18} />
        </span>
        <span className="co-sheet-bar-right">
          <span className="co-sheet-total-l">Total</span>
          <span className="co-sheet-total">{formatUSD(total)}</span>
        </span>
      </button>

      <div className="co-sheet-root" data-open={sheetOpen} aria-hidden={!sheetOpen}>
        <button
          className="co-sheet-scrim"
          aria-label="Close summary"
          onClick={() => setOpen(false)}
          tabIndex={sheetOpen ? 0 : -1}
        />
        <div className="co-sheet-panel" role="dialog" aria-label="Order summary" aria-modal="true" inert={!sheetOpen}>
          <div className="co-sheet-grab" aria-hidden="true" />
          <button ref={closeRef} className="co-sheet-srclose" aria-label="Close summary" onClick={() => setOpen(false)} />
          <div className="co-sheet-scroll">
            <OrderSummary variant="sheet" delivery={delivery} />
          </div>
          <button className="btn co-sheet-done" type="button" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
