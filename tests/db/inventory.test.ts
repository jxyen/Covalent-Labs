import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { listInventory, listMovements, restock, adjust } from '../../src/lib/admin/inventory'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

// create a throwaway product + size + inventory row; deleting the product cascades
async function makeSku(opts: { qty?: number; threshold?: number } = {}) {
  const tag = crypto.randomUUID().slice(0, 8)
  const { data: p } = await admin.from('products')
    .insert({ code: `DA-${tag}`, name: 'DA', sub: 's', category: 'Recovery & Repair' })
    .select().single()
  const { data: size } = await admin.from('product_sizes')
    .insert({ product_id: p!.id, mg: '5 mg', price: 1, sku: `DA-${tag}-5MG` })
    .select().single()
  await admin.from('inventory').insert({
    size_id: size!.id,
    quantity_on_hand: opts.qty ?? 0,
    reorder_threshold: opts.threshold ?? 0,
  })
  return { productId: p!.id as string, sizeId: size!.id as string, sku: size!.sku as string }
}

describe('inventory schema', () => {
  it('tracks stock per size', async () => {
    const { data: p } = await admin.from('products')
      .insert({ code: 'INV-1', name: 'Inv', sub: 's', category: 'Recovery & Repair' }).select().single()
    const { data: size } = await admin.from('product_sizes')
      .insert({ product_id: p!.id, mg: '5 mg', price: 1, sku: 'INV-1-5MG' }).select().single()
    const { error } = await admin.from('inventory')
      .insert({ size_id: size!.id, quantity_on_hand: 10, reorder_threshold: 3 })
    expect(error).toBeNull()
    await admin.from('products').delete().eq('code', 'INV-1')
  })
})

describe('inventory data layer', () => {
  it('restock increments stock and writes a restock movement', async () => {
    const { productId, sizeId } = await makeSku({ qty: 0 })
    try {
      await restock(admin, { sizeId, qty: 50, createdBy: null })
      const { data: inv } = await admin.from('inventory')
        .select('quantity_on_hand').eq('size_id', sizeId).single()
      expect(inv!.quantity_on_hand).toBe(50)
      const moves = await listMovements(admin, sizeId)
      expect(moves[0]).toMatchObject({ delta: 50, reason: 'restock' })
    } finally {
      await admin.from('products').delete().eq('id', productId)
    }
  })

  it('adjust applies a signed delta and stores the note', async () => {
    const { productId, sizeId } = await makeSku({ qty: 10 })
    try {
      await adjust(admin, { sizeId, delta: -3, note: 'damaged', createdBy: null })
      const { data: inv } = await admin.from('inventory')
        .select('quantity_on_hand').eq('size_id', sizeId).single()
      expect(inv!.quantity_on_hand).toBe(7)
      const moves = await listMovements(admin, sizeId)
      expect(moves[0]).toMatchObject({ delta: -3, reason: 'adjustment', note: 'damaged' })
    } finally {
      await admin.from('products').delete().eq('id', productId)
    }
  })

  it('rejects an adjustment that would drive stock negative', async () => {
    const { productId, sizeId } = await makeSku({ qty: 2 })
    try {
      await expect(adjust(admin, { sizeId, delta: -5, note: 'oops', createdBy: null }))
        .rejects.toThrow()
      const { data: inv } = await admin.from('inventory')
        .select('quantity_on_hand').eq('size_id', sizeId).single()
      expect(inv!.quantity_on_hand).toBe(2) // unchanged
      expect(await listMovements(admin, sizeId)).toHaveLength(0) // ledger rolled back too
    } finally {
      await admin.from('products').delete().eq('id', productId)
    }
  })

  it('listInventory returns joined fields and a lowStock flag', async () => {
    const { productId, sizeId, sku } = await makeSku({ qty: 1, threshold: 3 })
    try {
      const rows = await listInventory(admin)
      const row = rows.find((r) => r.sizeId === sizeId)
      expect(row).toBeDefined()
      expect(row).toMatchObject({ sku, quantityOnHand: 1, reorderThreshold: 3, lowStock: true })
      expect(row!.productName).toBe('DA')
    } finally {
      await admin.from('products').delete().eq('id', productId)
    }
  })
})
