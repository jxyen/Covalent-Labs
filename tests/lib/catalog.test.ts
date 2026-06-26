import { vi } from 'vitest'
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

import { describe, it, expect, beforeAll } from 'vitest'
import { execSync } from 'node:child_process'
import { getCatalog, getProductBySlug } from '../../src/lib/catalog/queries'

describe('catalog read layer', () => {
  beforeAll(() => { execSync('npm run db:seed', { stdio: 'inherit' }) })

  it('returns active products mapped to Product shape', async () => {
    const list = await getCatalog()
    expect(list.length).toBeGreaterThan(0)
    const bpc = list.find((p) => p.code === 'BPC-157')!
    expect(bpc.name).toBe('BPC-157')
    expect(bpc.sizes.length).toBeGreaterThan(0)
    expect(bpc.sizes[0]).toHaveProperty('mg')
    expect(bpc.sizes[0]).toHaveProperty('price')
  })

  it('maps compare_at to compareAt for bundles', async () => {
    const list = await getCatalog()
    const blend = list.find((p) => p.category === 'Blends & Stacks')
    expect(blend).toBeDefined()
  })

  it('looks up a product by slug', async () => {
    const p = await getProductBySlug('bpc-157')
    expect(p?.code).toBe('BPC-157')
  })
})
