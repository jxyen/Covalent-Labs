import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { ProductForm } from '../../product-form'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff()
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('products').select('*, product_sizes(*)').eq('id', id).single()
  if (!data) notFound()
  return <ProductForm mode="edit" productId={id} initial={data} />
}
