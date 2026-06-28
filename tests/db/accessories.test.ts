import { vi } from 'vitest'
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

import { describe, it, expect, beforeAll } from 'vitest'
import { execSync } from 'node:child_process'
import { getCatalog, getAccessories } from '../../src/lib/catalog/queries'

describe('accessories as catalog products', () => {
  // The 4 accessories ship with migration 0009 (present after db:reset); db:seed
  // ensures the 13 main products exist so the catalog-exclusion check is meaningful.
  beforeAll(() => { execSync('npm run db:seed', { stdio: 'inherit' }) })

  it('seeds four accessories with priced sizes', async () => {
    const acc = await getAccessories()
    expect(acc.map((a) => a.code).sort()).toEqual(['BAC-WATER', 'SWABS', 'SYRINGES', 'VIALS'])
    expect(acc.every((a) => typeof a.sizes[0]?.id === 'string' && a.sizes[0].price > 0)).toBe(true)
  })

  it('excludes accessories from the main catalog grid', async () => {
    const catalog = await getCatalog()
    expect(catalog.some((p) => p.code === 'SYRINGES')).toBe(false)
  })
})
