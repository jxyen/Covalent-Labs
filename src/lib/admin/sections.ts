import type { Database } from '@/lib/supabase/database.types'

export type TableName = keyof Database['public']['Tables']

export interface AdminSection {
  slug: string
  label: string
  /** Table used for the stub's live count. */
  table: TableName
  ownerOnly: boolean
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { slug: 'dashboard', label: 'Dashboard', table: 'orders', ownerOnly: true },
  { slug: 'orders', label: 'Orders', table: 'orders', ownerOnly: false },
  { slug: 'products', label: 'Products', table: 'products', ownerOnly: false },
  { slug: 'inventory', label: 'Inventory', table: 'product_sizes', ownerOnly: false },
  { slug: 'affiliates', label: 'Affiliates', table: 'affiliates', ownerOnly: false },
  { slug: 'shipping', label: 'Shipping', table: 'shipments', ownerOnly: false },
  { slug: 'staff', label: 'Staff', table: 'staff', ownerOnly: true },
]
