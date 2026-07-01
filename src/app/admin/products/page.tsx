import Link from 'next/link'
import { requireStaff } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { ActiveToggle } from './active-toggle'

export default async function ProductsPage() {
  await requireStaff()
  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('id,code,name,category,active,product_sizes(price)')
    .order('name')

  return (
    <section>
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <Link href="/admin/products/new" className="rounded-md bg-black px-3 py-1.5 text-sm text-white">New product</Link>
      </header>
      <table className="w-full text-sm">
        <thead className="text-left text-black/50">
          <tr><th className="py-2">Name</th><th>Category</th><th>Sizes</th><th>Price</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {(products ?? []).map((p) => {
            const prices = p.product_sizes.map((s) => Number(s.price))
            const min = Math.min(...prices)
            const max = Math.max(...prices)
            const range = prices.length ? (min === max ? `$${min}` : `$${min}–$${max}`) : '—'
            return (
              <tr key={p.id} className="border-t border-black/10">
                <td className="py-2 font-medium">{p.name} <span className="text-black/40">{p.code}</span></td>
                <td>{p.category}</td>
                <td>{p.product_sizes.length}</td>
                <td>{range}</td>
                <td>{p.active ? <span className="text-emerald-600">Active</span> : <span className="text-black/40">Inactive</span>}</td>
                <td className="text-right"><ActiveToggle id={p.id} active={p.active} /> <Link href={`/admin/products/${p.id}/edit`} className="text-blue-600">Edit</Link></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
