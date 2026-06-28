import { afterEach, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
const anon = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const orderIds: string[] = []
const eventIds: string[] = []
afterEach(async () => {
  for (const id of eventIds.splice(0)) await admin.from('payment_events').delete().eq('id', id)
  for (const id of orderIds.splice(0)) await admin.from('orders').delete().eq('id', id)
})

async function unmatchedEvent(amount: number) {
  const { data, error } = await admin.from('payment_events').insert({
    channel: 'push', method: 'venmo', amount, raw_text: 'You received', status: 'ambiguous',
    dedup_key: `dk-${Math.random().toString(36).slice(2)}`, received_at: new Date().toISOString(),
  }).select().single()
  if (error) throw error
  eventIds.push(data!.id)
  return data!
}

async function unpaidOrder(amount: number) {
  const order_number = `KL-20260628-A${Math.floor(Math.random() * 9000 + 1000)}`
  const { data, error } = await admin.from('orders').insert({
    order_number, customer_name: 'Test', status: 'pending',
    payment_method: 'venmo', payment_status: 'unpaid', subtotal: amount, total: amount,
  }).select().single()
  if (error) throw error
  orderIds.push(data!.id)
  return data!
}

describe('apply_payment_event + payment_events RLS', () => {
  it('staff one-tap applies an event to a chosen order', async () => {
    const ev = await unmatchedEvent(222.01)
    const o = await unpaidOrder(222.01)
    const r = await admin.rpc('apply_payment_event', { p_event_id: ev.id, p_order_number: o.order_number })
    expect(r.error).toBeNull()
    expect(r.data).toBe(o.order_number)
    const { data: od } = await admin.from('orders').select('payment_status').eq('id', o.id).single()
    expect(od!.payment_status).toBe('paid')
    const { data: evd } = await admin.from('payment_events').select('status, matched_order_id').eq('id', ev.id).single()
    expect(evd!.status).toBe('applied')
    expect(evd!.matched_order_id).toBe(o.id)
  })

  it('anon cannot read or insert payment_events', async () => {
    await unmatchedEvent(222.02)
    const { data: read } = await anon.from('payment_events').select('id')
    expect(read ?? []).toHaveLength(0) // RLS hides all rows from anon
    const { error: insErr } = await anon.from('payment_events').insert({
      channel: 'push', method: 'venmo', amount: 1, raw_text: 'x',
      dedup_key: `dk-${Math.random()}`, received_at: new Date().toISOString(),
    })
    expect(insErr).not.toBeNull()
  })

  it('anon cannot execute the payment RPCs', async () => {
    const r1 = await anon.rpc('mark_order_paid', { p_order_id: '00000000-0000-0000-0000-000000000000', p_event_id: null })
    expect(r1.error).not.toBeNull()
    const r2 = await anon.rpc('ingest_payment_event', { p_payload: { method: 'venmo', amount: 1, raw_text: 'x', dedup_key: `dk-${Math.random()}`, received_at: new Date().toISOString() } })
    expect(r2.error).not.toBeNull()
    const r3 = await anon.rpc('apply_payment_event', { p_event_id: '00000000-0000-0000-0000-000000000000', p_order_number: 'KL-20260628-ZZZZ' })
    expect(r3.error).not.toBeNull()
  })

  it('refuses to apply one event to a second order', async () => {
    const ev = await unmatchedEvent(223.55)
    const a = await unpaidOrder(223.55)
    const b = await unpaidOrder(223.55)
    const first = await admin.rpc('apply_payment_event', { p_event_id: ev.id, p_order_number: a.order_number })
    expect(first.error).toBeNull()
    const second = await admin.rpc('apply_payment_event', { p_event_id: ev.id, p_order_number: b.order_number })
    expect(second.error).not.toBeNull()
    const { data: bd } = await admin.from('orders').select('payment_status').eq('id', b.id).single()
    expect(bd!.payment_status).toBe('unpaid')
  })
})
