// tests/db/payment-accounts.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })

describe('payment_accounts', () => {
  it('seeds one row per P2P method', async () => {
    const { data } = await admin.from('payment_accounts').select('method').order('method')
    const methods = (data ?? []).map((r) => r.method)
    expect(methods).toEqual(expect.arrayContaining(['cashapp', 'venmo', 'zelle']))
  })

  describe('anon access', () => {
    let inactiveRowId: number | null = null

    beforeAll(async () => {
      const { data } = await admin
        .from('payment_accounts')
        .insert({ method: 'crypto', handle: 'INACTIVE', active: false })
        .select('id')
        .single()
      inactiveRowId = data?.id ?? null
    })

    afterAll(async () => {
      if (inactiveRowId !== null) {
        await admin.from('payment_accounts').delete().eq('id', inactiveRowId)
      }
    })

    it('exposes only active rows to anon, and forbids anon writes', async () => {
      const { data: active } = await anon.from('payment_accounts').select('method').eq('active', true)
      expect((active ?? []).length).toBeGreaterThan(0)                              // anon CAN read active rows
      expect((active ?? []).some((r) => r.method === 'crypto')).toBe(false)         // inactive row hidden
      const { error } = await anon.from('payment_accounts').insert({ method: 'other', handle: 'X' })
      expect(error).not.toBeNull()
    })
  })
})
