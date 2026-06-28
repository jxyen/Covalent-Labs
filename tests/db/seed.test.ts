import { describe, it, expect, beforeAll } from 'vitest'
import { execSync } from 'node:child_process'
import { createAdminClient } from '../../src/lib/supabase/admin'
import { SEED_PRODUCTS } from '../../scripts/seed-data'

describe('product seed', () => {
  beforeAll(() => {
    execSync('npm run db:seed', { stdio: 'inherit' })
  })

  it('seeds every product from seed-data.ts', async () => {
    const admin = createAdminClient()
    // Accessories (is_accessory=true) ship via migration 0009, not db:seed.
    const { count } = await admin
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_accessory', false)
    expect(count).toBe(SEED_PRODUCTS.length)
  })

  it('creates an inventory row for every size', async () => {
    const admin = createAdminClient()
    // Accessory sizes are priced but stock-less, so scope to non-accessory sizes.
    const sizes = await admin
      .from('product_sizes')
      .select('id, products!inner(is_accessory)', { count: 'exact', head: true })
      .eq('products.is_accessory', false)
    const inv = await admin.from('inventory').select('*', { count: 'exact', head: true })
    expect(inv.count).toBe(sizes.count)
  })
})
