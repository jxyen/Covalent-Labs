import { afterEach, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const created: string[] = []
afterEach(async () => {
  for (const id of created.splice(0)) await admin.from('orders').delete().eq('id', id)
})

async function newOrder(amount: number, method: 'venmo' | 'cashapp' | 'zelle' = 'venmo') {
  const order_number = `KL-20260628-T${Math.floor(Math.random() * 9000 + 1000)}`
  const { data, error } = await admin.from('orders').insert({
    order_number, customer_name: 'Test', status: 'pending',
    payment_method: method, payment_status: 'unpaid', subtotal: amount, total: amount,
  }).select().single()
  if (error) throw error
  created.push(data!.id)
  return data!
}

describe('mark_order_paid', () => {
  it('marks the order paid, records one payment, is idempotent', async () => {
    const order = await newOrder(42.11)
    const r1 = await admin.rpc('mark_order_paid', { p_order_id: order.id, p_event_id: null })
    expect(r1.error).toBeNull()
    expect(r1.data).toBe(order.order_number)

    const { data: o } = await admin.from('orders').select('status, payment_status').eq('id', order.id).single()
    expect(o!.payment_status).toBe('paid')
    expect(o!.status).toBe('paid')

    // call again — must stay paid with still exactly one payment row
    await admin.rpc('mark_order_paid', { p_order_id: order.id, p_event_id: null })
    const { data: pays } = await admin.from('payments').select('id, status, amount').eq('order_id', order.id)
    expect(pays!.length).toBe(1)
    expect(pays![0].status).toBe('confirmed')
    expect(Number(pays![0].amount)).toBe(42.11)
  })

  it('raises on an unknown order', async () => {
    const r = await admin.rpc('mark_order_paid', {
      p_order_id: '00000000-0000-0000-0000-000000000000', p_event_id: null,
    })
    expect(r.error).not.toBeNull()
  })
})
