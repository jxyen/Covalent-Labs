import { notFound } from "next/navigation";
import Image from "next/image";
import { getOrderForPayment } from "@/lib/orders/queries";
import { getPaymentAccountForMethod } from "@/lib/payments/accounts";
import { paymentDeepLink } from "@/lib/payments/payment-links";
import { paymentQrSvg } from "@/lib/payments/qr";
import { formatUSD } from "@/lib/products";
import { CopyButton } from "@/components/copy-button";
import { PaymentStatusWatcher } from "./payment-status";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = { zelle: "Zelle", cashapp: "Cash App", venmo: "Venmo" };

export default async function OrderPage({ params }: { params: Promise<{ order_number: string }> }) {
  const { order_number } = await params;
  const order = await getOrderForPayment(order_number);
  if (!order) notFound();
  const account = await getPaymentAccountForMethod(order.paymentMethod);
  const label = LABELS[order.paymentMethod] ?? order.paymentMethod;

  // QR precedence: an uploaded image (e.g. a bank's Zelle QR) wins; otherwise
  // auto-generate one from the handle for Cash App / Venmo, amount prefilled.
  const uploadedQr = account?.qrUrl ?? null;
  const payUrl = account ? paymentDeepLink(order.paymentMethod, account.handle, order.total) : null;
  const generatedQrSvg = !uploadedQr && payUrl ? await paymentQrSvg(payUrl) : null;

  const codeSection = (
    <section style={{ border: "1px solid var(--hair)", borderRadius: 12, padding: 20, marginBottom: 16, textAlign: "center" }}>
      <div style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>Your Order Code</div>
      <div className="font-mono" style={{ fontSize: 26, fontWeight: 700, letterSpacing: "0.04em", margin: "6px 0" }}>{order.orderNumber}</div>
      <CopyButton value={order.orderNumber} label="Copy code" />
      <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 6 }}>Include this code in your payment memo/note</div>
    </section>
  );

  const paidBody = (
    <p style={{ fontSize: 14 }}>We’ve received your payment. Your order is being processed and will ship soon.</p>
  );

  const pendingBody = (
    <section style={{ border: "1px solid var(--hair)", borderRadius: 12, padding: 20 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{label} Payment Details</h2>
      {uploadedQr ? (
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <Image src={uploadedQr} alt={`${label} QR`} width={180} height={180} unoptimized />
        </div>
      ) : generatedQrSvg ? (
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div
            role="img"
            aria-label={`${label} payment QR code`}
            style={{ display: "inline-block", width: 176, height: 176 }}
            dangerouslySetInnerHTML={{ __html: generatedQrSvg }}
          />
          <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 6 }}>Scan to open {label}</div>
        </div>
      ) : null}
      <Line label={`Send ${label} to`} value={account?.handle ?? "—"} copy={account?.handle} />
      <Line label="Amount to send" value={formatUSD(order.total)} copy={String(order.total)} />
      <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "rgba(245, 200, 66, 0.12)", border: "1px solid rgba(245,200,66,0.4)", fontSize: 13 }}>
        <strong>⚠ Include in payment note:</strong> your order code <span className="font-mono">{order.orderNumber}</span>. It’s all we need to match your payment to your order.
      </div>
      <ol style={{ marginTop: 16, paddingLeft: 18, fontSize: 13, color: "var(--ink-muted)", display: "flex", flexDirection: "column", gap: 6 }}>
        <li>Open {label} and send {formatUSD(order.total)} to {account?.handle ?? "our account"}.</li>
        <li>In the note, include your order code ({order.orderNumber}).</li>
        <li>Once payment is received, your order will ship.</li>
      </ol>
      <p style={{ marginTop: 16, fontSize: 12.5, color: "var(--ink-ghost)" }}>
        A confirmation email is on the way — please check your spam/junk folder. Refund policy: once an order has begun
        processing, no returns or refunds are possible unless there is an issue with the product with evidence provided.
      </p>
    </section>
  );

  return (
    <main className="container" style={{ padding: "32px 20px 80px", maxWidth: 560 }}>
      <PaymentStatusWatcher
        orderNumber={order.orderNumber}
        initialPaymentStatus={order.paymentStatus}
        pendingPillLabel={`Payment Pending — ${label}`}
        codeSection={codeSection}
        pendingBody={pendingBody}
        paidBody={paidBody}
      />
    </main>
  );
}

function Line({ label, value, copy }: { label: string; value: string; copy?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--hair)" }}>
      <div>
        <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>{label}</div>
        <div className="font-mono" style={{ fontWeight: 600 }}>{value}</div>
      </div>
      {copy && <CopyButton value={copy} />}
    </div>
  );
}
