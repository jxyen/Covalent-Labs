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
