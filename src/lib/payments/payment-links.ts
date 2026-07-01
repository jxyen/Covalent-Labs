// Plain module: builds the public "pay me" deep link for a payment account,
// used to auto-generate a scannable QR on the order pay page.
import type { Database } from '@/lib/supabase/database.types'

export type PaymentMethod = Database['public']['Enums']['payment_method']

/**
 * A link the customer can scan/tap to reach the destination account.
 * - Cash App and Venmo have public link formats.
 * - Zelle has none (its QR is generated inside the customer's bank app), so it
 *   returns null — Zelle stays handle-as-text or a manually uploaded image.
 * `amount` (the order total) is prefilled for Cash App, which supports it;
 * Venmo's scan links don't reliably honor a prefilled amount, so it's omitted.
 */
export function paymentDeepLink(
  method: PaymentMethod,
  handle: string | null | undefined,
  amount?: number,
): string | null {
  const h = (handle ?? '').trim()
  if (!h) return null

  switch (method) {
    case 'cashapp': {
      const tag = h.replace(/^\$+/, '').trim()
      if (!tag) return null
      const amt = amount != null && amount > 0 ? `/${amount.toFixed(2)}` : ''
      return `https://cash.app/$${tag}${amt}`
    }
    case 'venmo': {
      const user = h.replace(/^@+/, '').trim()
      if (!user) return null
      return `https://venmo.com/u/${user}`
    }
    default:
      return null
  }
}
