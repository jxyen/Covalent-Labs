import { getActivePaymentAccounts } from "@/lib/payments/accounts";
import { CheckoutForm } from "./checkout-form";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const accounts = await getActivePaymentAccounts();
  const methods = accounts.map((a) => ({ method: a.method, label: a.method }));
  return (
    <main className="container" style={{ padding: "32px 20px 80px", maxWidth: 720 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Checkout</h1>
      <CheckoutForm methods={methods} />
    </main>
  );
}
