import { vi } from 'vitest'
vi.mock('@/lib/auth/dal', () => ({ requireStaff: async () => ({ id: 'test', role: 'owner', active: true }) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    const { createClient } = await import('@supabase/supabase-js')
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  },
}))
vi.mock('next/cache', () => ({ revalidateTag: () => {} }))

import { describe, it, expect, afterAll } from 'vitest'
import { createProduct, updateProduct, setProductActive, deleteSize } from '../../src/app/admin/products/actions'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

const base = {
  code: 'ADM-TEST', name: 'Admin Test', category: 'Recovery & Repair' as const,
  sizes: [{ mg: '5 mg', price: 10, sku: 'ADM-TEST-5MG' }],
}

afterAll(async () => {
  await admin.from('products').delete().eq('code', 'ADM-TEST')
  await admin.from('products').delete().eq('code', 'ADM-UPD')
  await admin.from('products').delete().eq('code', 'ADM-ORPH')
})

describe('product actions', () => {
  let id: string
  it('creates a product with a size', async () => {
    const r = await createProduct(base)
    expect(r.ok).toBe(true)
    const { data } = await admin.from('products').select('id,product_sizes(id)').eq('code', 'ADM-TEST').single()
    id = data!.id
    expect(data!.product_sizes).toHaveLength(1)
  })
  it('rejects duplicate code', async () => {
    const r = await createProduct(base)
    expect(r.ok).toBe(false)
  })
  it('soft-deletes (deactivates)', async () => {
    const r = await setProductActive(id, false)
    expect(r.ok).toBe(true)
    const { data } = await admin.from('products').select('active').eq('id', id).single()
    expect(data!.active).toBe(false)
  })
  it('blocks deleting the last size', async () => {
    const { data } = await admin.from('product_sizes').select('id').eq('sku', 'ADM-TEST-5MG').single()
    const r = await deleteSize(data!.id)
    expect(r.ok).toBe(false)
  })

  it('updates product fields and an existing size', async () => {
    await createProduct({ code: 'ADM-UPD', name: 'Upd', category: 'Recovery & Repair', sizes: [{ mg: '5 mg', price: 10, sku: 'ADM-UPD-5MG' }] })
    const { data: created } = await admin.from('products').select('id, product_sizes(id)').eq('code', 'ADM-UPD').single()
    const sizeId = created!.product_sizes[0].id
    const r = await updateProduct(created!.id, { code: 'ADM-UPD', name: 'Upd Renamed', category: 'Recovery & Repair', sizes: [{ id: sizeId, mg: '5 mg', price: 14, sku: 'ADM-UPD-5MG' }] })
    expect(r.ok).toBe(true)
    const { data: after } = await admin.from('products').select('name, product_sizes(price)').eq('id', created!.id).single()
    expect(after!.name).toBe('Upd Renamed')
    expect(Number(after!.product_sizes[0].price)).toBe(14)
    await admin.from('products').delete().eq('code', 'ADM-UPD')
  })

  it('leaves no orphan product when a size insert fails', async () => {
    // two sizes with the SAME sku violate the unique constraint on the batch insert
    const r = await createProduct({ code: 'ADM-ORPH', name: 'Orph', category: 'Recovery & Repair', sizes: [{ mg: '5 mg', price: 10, sku: 'ADM-ORPH-DUP' }, { mg: '10 mg', price: 18, sku: 'ADM-ORPH-DUP' }] })
    expect(r.ok).toBe(false)
    const { data } = await admin.from('products').select('id').eq('code', 'ADM-ORPH')
    expect(data).toHaveLength(0) // orphan cleaned up
  })
})
