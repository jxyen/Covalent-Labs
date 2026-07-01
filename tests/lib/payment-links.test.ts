import { describe, expect, it } from 'vitest'
import { paymentDeepLink } from '@/lib/payments/payment-links'

describe('paymentDeepLink', () => {
  it('builds a Cash App cashtag link and normalizes a leading $', () => {
    expect(paymentDeepLink('cashapp', '$KairoLabs')).toBe('https://cash.app/$KairoLabs')
    expect(paymentDeepLink('cashapp', 'KairoLabs')).toBe('https://cash.app/$KairoLabs')
  })

  it('prefills the Cash App amount when provided', () => {
    expect(paymentDeepLink('cashapp', '$KairoLabs', 42.5)).toBe('https://cash.app/$KairoLabs/42.50')
  })

  it('builds a Venmo profile link and strips a leading @', () => {
    expect(paymentDeepLink('venmo', '@kairo')).toBe('https://venmo.com/u/kairo')
    expect(paymentDeepLink('venmo', 'kairo')).toBe('https://venmo.com/u/kairo')
  })

  it('does not prefill an amount for Venmo', () => {
    expect(paymentDeepLink('venmo', 'kairo', 42.5)).toBe('https://venmo.com/u/kairo')
  })

  it('returns null for Zelle (no public link format)', () => {
    expect(paymentDeepLink('zelle', 'pay@kairolabs.org')).toBeNull()
  })

  it('returns null for an empty, whitespace, or bare-symbol handle', () => {
    expect(paymentDeepLink('cashapp', '')).toBeNull()
    expect(paymentDeepLink('venmo', '   ')).toBeNull()
    expect(paymentDeepLink('cashapp', '$')).toBeNull()
  })
})
