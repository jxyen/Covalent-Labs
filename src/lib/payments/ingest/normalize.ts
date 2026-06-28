import { createHash } from 'node:crypto'
import type { Database } from '@/lib/supabase/database.types'

export type PaymentMethod = Database['public']['Enums']['payment_method']

export interface NormalizedPaymentEvent {
  channel: string
  method: PaymentMethod
  amount: number
  sender?: string
  note?: string
  rawText: string
  externalId?: string
  receivedAt: string // ISO 8601
}

const ORDER_CODE_RE = /KL-\d{8}-[A-Z0-9]{4}/i

export function extractOrderCode(text: string | null | undefined): string | null {
  if (!text) return null
  const m = text.match(ORDER_CODE_RE)
  return m ? m[0].toUpperCase() : null
}

export function buildDedupKey(e: NormalizedPaymentEvent): string {
  const basis = [
    e.channel, e.method, e.amount.toFixed(2),
    e.sender ?? '', e.note ?? '', e.rawText, e.receivedAt,
  ].join('|')
  return createHash('sha256').update(basis).digest('hex')
}

export function toIngestPayload(e: NormalizedPaymentEvent): Record<string, unknown> {
  return {
    channel: e.channel,
    method: e.method,
    amount: e.amount,
    sender: e.sender ?? null,
    note: e.note ?? null,
    raw_text: e.rawText,
    external_id: e.externalId ?? null,
    received_at: e.receivedAt,
    dedup_key: buildDedupKey(e),
  }
}
