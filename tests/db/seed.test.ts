import { describe, it, expect, beforeAll } from 'vitest'
import { execSync } from 'node:child_process'
import { createAdminClient } from '../../src/lib/supabase/admin'
import { SEED_PRODUCTS } from '../../scripts/seed-data'

describe('product seed', () => {
  beforeAll(() => {
    execSync('npm run db:seed', { stdio: 'inherit' })
  })

  it('seeds every product from products.ts', async () => {
    const admin = createAdminClient()
    const { count } = await admin.from('products').select('*', { count: 'exact', head: true })
    expect(count).toBe(SEED_PRODUCTS.length)
  })

  it('creates an inventory row for every size', async () => {
    const admin = createAdminClient()
    const sizes = await admin.from('product_sizes').select('*', { count: 'exact', head: true })
    const inv = await admin.from('inventory').select('*', { count: 'exact', head: true })
    expect(inv.count).toBe(sizes.count)
  })
})
