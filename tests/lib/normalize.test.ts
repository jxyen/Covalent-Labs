import { describe, expect, it } from 'vitest'
import { buildDedupKey, extractOrderCode, toIngestPayload, type NormalizedPaymentEvent } from '@/lib/payments/ingest/normalize'

const base: NormalizedPaymentEvent = {
  channel: 'push', method: 'venmo', amount: 42.5, sender: 'Jane',
  note: 'KL-20260628-AB23', rawText: 'You received $42.50 from Jane — KL-20260628-AB23',
  receivedAt: '2026-06-28T12:00:00.000Z',
}

describe('extractOrderCode', () => {
  it('finds an uppercase code', () => {
    expect(extractOrderCode('memo KL-20260628-AB23 here')).toBe('KL-20260628-AB23')
  })
  it('uppercases a lowercase code', () => {
    expect(extractOrderCode('kl-20260628-ab23')).toBe('KL-20260628-AB23')
  })
  it('returns null when no code is present', () => {
    expect(extractOrderCode('thanks for lunch')).toBeNull()
    expect(extractOrderCode(null)).toBeNull()
  })
})

describe('buildDedupKey', () => {
  it('is stable for identical input', () => {
    expect(buildDedupKey(base)).toBe(buildDedupKey({ ...base }))
  })
  it('changes when any field changes', () => {
    expect(buildDedupKey(base)).not.toBe(buildDedupKey({ ...base, amount: 42.51 }))
    expect(buildDedupKey(base)).not.toBe(buildDedupKey({ ...base, receivedAt: '2026-06-28T12:00:01.000Z' }))
  })
})

describe('toIngestPayload', () => {
  it('emits the snake_case RPC payload with a dedup_key', () => {
    const p = toIngestPayload(base)
    expect(p).toMatchObject({
      channel: 'push', method: 'venmo', amount: 42.5, sender: 'Jane',
      note: 'KL-20260628-AB23', raw_text: base.rawText, received_at: base.receivedAt,
    })
    expect(typeof p.dedup_key).toBe('string')
    expect((p.dedup_key as string).length).toBeGreaterThan(0)
  })
})
