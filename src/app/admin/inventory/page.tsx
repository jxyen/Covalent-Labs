import { requireStaff } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { listInventory } from '@/lib/admin/inventory'
import { InventoryTable } from './inventory-table'

export default async function InventoryPage() {
  await requireStaff()
  const supabase = await createClient()
  const rows = await listInventory(supabase)
  const low = rows.filter((r) => r.lowStock).length

  return (
    <section>
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <span className="text-sm text-black/50">
          {rows.length} SKUs
          {low > 0 && (
            <>
              {' · '}
              <span className="text-amber-700">{low} low</span>
            </>
          )}
        </span>
      </header>
      <InventoryTable rows={rows} />
    </section>
  )
}
