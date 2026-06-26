import { describe, it, expect } from 'vitest'
import { ADMIN_SECTIONS } from '../../src/lib/admin/sections'

describe('admin sections', () => {
  it('defines all seven feature sections', () => {
    const slugs = ADMIN_SECTIONS.map((s) => s.slug)
    expect(slugs).toEqual([
      'dashboard', 'orders', 'products', 'inventory', 'affiliates', 'shipping', 'staff',
    ])
  })
  it('marks dashboard as owner-only', () => {
    expect(ADMIN_SECTIONS.find((s) => s.slug === 'dashboard')?.ownerOnly).toBe(true)
  })
})
