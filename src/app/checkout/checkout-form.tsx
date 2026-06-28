"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart-context";
import { orderTotals } from "@/lib/cart/cart";
import { formatUSD } from "@/lib/products";
import { placeOrder } from "@/lib/orders/place-order";
import { type PlaceOrderState } from "@/lib/orders/place-order-schema";

const LABELS: Record<string, string> = { zelle: "Zelle", cashapp: "Cash App", venmo: "Venmo" };
const initial: PlaceOrderState = { ok: false, error: "" };

export function CheckoutForm({ methods }: { methods: { method: string; label: string }[] }) {
  const { items, clear } = useCart();
  const router = useRouter();
  const t = orderTotals(items);
  const [state, action, pending] = useActionState(placeOrder, initial);

  useEffect(() => {
    if (state.ok) { clear(); router.push(`/order/${state.orderNumber}`); }
  }, [state, clear, router]);

  const rpcItems = items.map((x) => ({ size_id: x.sizeId, quantity: x.quantity }));

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input type="hidden" name="items" value={JSON.stringify(rpcItems)} />

      <Field name="name" label="Full name" required />
      <Field name="email" label="Email" type="email" required />
      <Field name="phone" label="Phone (optional)" />
      <Field name="line1" label="Address" required />
      <Field name="line2" label="Apt / unit (optional)" />
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
        <Field name="city" label="City" required />
        <Field name="state" label="State" required />
        <Field name="postal_code" label="ZIP" required />
      </div>
      <input type="hidden" name="country" value="US" />

      <fieldset style={{ border: "1px solid var(--hair)", borderRadius: 10, padding: 12 }}>
        <legend style={{ fontSize: 13, fontWeight: 600 }}>Payment method</legend>
        {methods.map((m, i) => (
          <label key={m.method} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0" }}>
            <input type="radio" name="method" value={m.method} defaultChecked={i === 0} required />
            {LABELS[m.method] ?? m.label}
          </label>
        ))}
      </fieldset>

      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 17 }}>
        <span>Total</span><span>{formatUSD(t.total)}</span>
      </div>

      {!state.ok && state.error && <div style={{ color: "#c0392b", fontSize: 13 }}>{state.error}</div>}

      <button className="btn btn-emerald" disabled={pending || items.length === 0}>
        {pending ? "Placing order…" : "Place order"}
      </button>
    </form>
  );
}

function Field({ name, label, type = "text", required }: { name: string; label: string; type?: string; required?: boolean }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
      <span>{label}</span>
      <input name={name} type={type} required={required}
        style={{ padding: "10px 12px", border: "1px solid var(--hair)", borderRadius: 8 }} />
    </label>
  );
}
