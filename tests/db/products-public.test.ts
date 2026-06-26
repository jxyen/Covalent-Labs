// tests/db/products-public.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const admin = createClient(url, service, { auth: { persistSession: false } })
const anon = createClient(url, anonKey, { auth: { persistSession: false } })

describe('public catalog RLS', () => {
  let activeId: string
  let inactiveId: string

  beforeAll(async () => {
    const a = await admin.from('products')
      .insert({ code: 'PUB-ACTIVE', name: 'Active', category: 'Recovery & Repair', active: true })
      .select().single()
    activeId = a.data!.id
    const i = await admin.from('products')
      .insert({ code: 'PUB-INACTIVE', name: 'Inactive', category: 'Recovery & Repair', active: false })
      .select().single()
    inactiveId = i.data!.id
  })

  it('anon can read active products', async () => {
    const { data } = await anon.from('products').select('*').eq('id', activeId)
    expect(data).toHaveLength(1)
  })

  it('anon cannot read inactive products', async () => {
    const { data } = await anon.from('products').select('*').eq('id', inactiveId)
    expect(data).toHaveLength(0)
  })

  it('anon cannot insert products', async () => {
    const { error } = await anon.from('products')
      .insert({ code: 'PUB-HACK', name: 'x', category: 'Recovery & Repair' })
    expect(error).not.toBeNull()
  })

  afterAll(async () => {
    await admin.from('products').delete().in('code', ['PUB-ACTIVE', 'PUB-INACTIVE'])
  })
})
