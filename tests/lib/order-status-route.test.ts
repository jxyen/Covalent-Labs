import { afterAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { GET } from '@/app/api/order/[order_number]/status/route'

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

let orderId: string | undefined
afterAll(async () => { if (orderId) await admin.from('orders').delete().eq('id', orderId) })

function call(order_number: string) {
  return GET(new Request(`http://localhost/api/order/${order_number}/status`), {
    params: Promise.resolve({ order_number }),
  })
}

describe('GET /api/order/[order_number]/status', () => {
  it('returns the payment + order status for a real order', async () => {
    const order_number = `KL-20260628-S${Math.floor(Math.random() * 9000 + 1000)}`
    const { data } = await admin.from('orders').insert({
      order_number, customer_name: 'Test', status: 'pending',
      payment_method: 'venmo', payment_status: 'unpaid', subtotal: 5, total: 5,
    }).select().single()
    orderId = data!.id
    const res = await call(order_number)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ paymentStatus: 'unpaid', status: 'pending' })
  })

  it('returns 404 for an unknown order', async () => {
    const res = await call('KL-20260628-ZZZZ')
    expect(res.status).toBe(404)
  })
})
