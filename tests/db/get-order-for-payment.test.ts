import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })

describe('get_order_for_payment', () => {
  afterAll(async () => { await admin.from('orders').delete().eq('order_number', 'KL-GETME-01') })

  it('returns safe fields for a known order and nothing for unknown', async () => {
    await admin.from('orders').insert({
      order_number: 'KL-GETME-01', customer_name: 'Secret Person', customer_email: 'secret@x.com',
      status: 'pending', payment_method: 'zelle', payment_status: 'unpaid', subtotal: 50, total: 59.99,
    })
    const { data } = await anon.rpc('get_order_for_payment', { p_order_number: 'KL-GETME-01' })
    expect(data).toHaveLength(1)
    expect(Number(data![0].total)).toBeCloseTo(59.99, 2)
    expect(data![0].payment_method).toBe('zelle')
    expect(JSON.stringify(data![0])).not.toMatch(/Secret Person|secret@x.com/)

    const { data: none } = await anon.rpc('get_order_for_payment', { p_order_number: 'KL-NOPE-99' })
    expect(none).toHaveLength(0)
  })
})
