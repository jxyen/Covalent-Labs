"use client";
import Link from "next/link";
import { useCart } from "@/components/cart-context";
import { orderTotals, lineTotal } from "@/lib/cart/cart";
import { formatUSD, FREE_SHIP_THRESHOLD } from "@/lib/products";

export default function CartPage() {
  const { items, setQty, remove } = useCart();
  const t = orderTotals(items);

  if (items.length === 0) {
    return (
      <main className="container" style={{ padding: "48px 20px", textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Your cart is empty</h1>
        <Link className="btn btn-emerald" href="/catalog">Browse catalog</Link>
      </main>
    );
  }

  const remaining = Math.max(0, FREE_SHIP_THRESHOLD - t.merch);

  return (
    <main className="container" style={{ padding: "32px 20px 80px", maxWidth: 720 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Your cart</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((x) => (
          <div key={x.sizeId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--hair)" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{x.productName}</div>
              <div className="font-mono" style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{x.mg} · {formatUSD(x.unitPrice)} each</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input type="number" min={1} max={99} value={x.quantity}
                onChange={(e) => setQty(x.sizeId, Number(e.target.value))}
                style={{ width: 56, padding: "6px 8px", border: "1px solid var(--hair)", borderRadius: 8 }} />
              <div style={{ width: 80, textAlign: "right", fontWeight: 600 }}>{formatUSD(lineTotal(x))}</div>
              <button onClick={() => remove(x.sizeId)} aria-label="Remove" style={{ color: "var(--ink-ghost)" }}>✕</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 6 }}>
        <Row label="Subtotal" value={formatUSD(t.subtotal)} />
        {t.discount > 0 && <Row label="Volume discount" value={`−${formatUSD(t.discount)}`} />}
        <Row label="Shipping" value={t.shipping === 0 ? "FREE" : formatUSD(t.shipping)} />
        {remaining > 0 && <div style={{ fontSize: 12.5, color: "var(--emerald-bright)" }}>Add {formatUSD(remaining)} more for free shipping</div>}
        <Row label="Total" value={formatUSD(t.total)} bold />
      </div>

      <Link className="btn btn-emerald" href="/checkout" style={{ marginTop: 20, display: "inline-block" }}>
        Proceed to checkout
      </Link>
    </main>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: bold ? 700 : 400, fontSize: bold ? 17 : 14 }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
