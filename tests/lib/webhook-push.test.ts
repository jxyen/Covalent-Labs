import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { POST } from '@/app/api/payments/ingest/push/route'

const SECRET = 'test-webhook-secret'
const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

function req(body: unknown, auth?: string) {
  return new Request('http://localhost/api/payments/ingest/push', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body),
  })
}

beforeAll(() => { process.env.PAYMENT_WEBHOOK_SECRET = SECRET })

let orderId: string | undefined
afterAll(async () => {
  if (orderId) {
    await admin.from('payment_events').delete().eq('matched_order_id', orderId)
    await admin.from('orders').delete().eq('id', orderId)
  }
})

describe('POST /api/payments/ingest/push', () => {
  it('rejects a missing Bearer token with 401', async () => {
    const res = await POST(req({ app: 'com.venmo', text: '$1.00' }))
    expect(res.status).toBe(401)
  })

  it('rejects a wrong Bearer token with 401', async () => {
    const res = await POST(req({ app: 'com.venmo', text: '$1.00' }, 'Bearer nope'))
    expect(res.status).toBe(401)
  })

  it('returns 422 on an unparseable amount', async () => {
    const res = await POST(req({ app: 'com.venmo', text: 'no money' }, `Bearer ${SECRET}`))
    expect(res.status).toBe(422)
  })

  it('ingests a valid push and auto-applies a matching order', async () => {
    const amount = 333.77
    const order_number = `KL-20260628-W${Math.floor(Math.random() * 9000 + 1000)}`
    const { data } = await admin.from('orders').insert({
      order_number, customer_name: 'Test', status: 'pending',
      payment_method: 'venmo', payment_status: 'unpaid', subtotal: amount, total: amount,
    }).select().single()
    orderId = data!.id

    const res = await POST(req(
      { app: 'com.venmo', title: 'Venmo', text: `Jane paid you $${amount} - ${order_number}` },
      `Bearer ${SECRET}`,
    ))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('applied')
    expect(json.orderNumber).toBe(order_number)

    const { data: od } = await admin.from('orders').select('payment_status').eq('id', orderId!).single()
    expect(od!.payment_status).toBe('paid')
  })
})
