# Payment Accounts — admin brief

**Route:** `src/app/admin/payment-accounts/page.tsx`
**Table:** `payment_accounts` (+ `payment-qr` Storage bucket)
**Access:** `requireOwner` (money-sensitive)

Owners edit the Zelle / Cash App / Venmo handles, toggle `active`, set `sort_order`,
and upload a QR image. The storefront checkout and `/order/[order_number]` pay page
read active rows live (public RLS `select` where `active = true`). Changes take
effect with no redeploy. Built by the storefront checkout feature
(`docs/superpowers/specs/2026-06-27-storefront-checkout-payments-design.md`).
