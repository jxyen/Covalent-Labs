'use server'
import { revalidateTag } from 'next/cache'
import { requireStaff } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { productSchema, type ProductInput } from './schema'

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

export async function createProduct(input: ProductInput): Promise<ActionResult> {
  await requireStaff()
  const parsed = productSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  const supabase = await createClient()
  const { data: product, error } = await supabase.from('products').insert({
    code: v.code, name: v.name, sub: v.sub, category: v.category, image: v.image,
    mechanism: v.mechanism, tagline: v.tagline, purity: v.purity, blurb: v.blurb,
    rating: v.rating, reviews: v.reviews, bestseller: v.bestseller, featured: v.featured,
    compare_at: v.compareAt ?? null,
  }).select('id').single()
  if (error) return { ok: false, error: error.message }
  const { error: sErr } = await supabase.from('product_sizes').insert(
    v.sizes.map((s) => ({ product_id: product.id, mg: s.mg, price: s.price, sku: s.sku })),
  )
  if (sErr) {
    await supabase.from('products').delete().eq('id', product.id)
    return { ok: false, error: sErr.message }
  }
  revalidateTag('catalog')
  return { ok: true, id: product.id }
}

export async function updateProduct(id: string, input: ProductInput): Promise<ActionResult> {
  await requireStaff()
  const parsed = productSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from('products').update({
    code: v.code, name: v.name, sub: v.sub, category: v.category, image: v.image,
    mechanism: v.mechanism, tagline: v.tagline, purity: v.purity, blurb: v.blurb,
    rating: v.rating, reviews: v.reviews, bestseller: v.bestseller, featured: v.featured,
    compare_at: v.compareAt ?? null, updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  for (const s of v.sizes) {
    if (s.id) {
      const { error: uErr } = await supabase.from('product_sizes').update({ mg: s.mg, price: s.price, sku: s.sku }).eq('id', s.id)
      if (uErr) return { ok: false, error: uErr.message }
    } else {
      const { error: iErr } = await supabase.from('product_sizes').insert({ product_id: id, mg: s.mg, price: s.price, sku: s.sku })
      if (iErr) return { ok: false, error: iErr.message }
    }
  }
  revalidateTag('catalog')
  return { ok: true }
}

export async function setProductActive(id: string, active: boolean): Promise<ActionResult> {
  await requireStaff()
  const supabase = await createClient()
  const { error } = await supabase.from('products').update({ active }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidateTag('catalog')
  return { ok: true }
}

export async function deleteSize(sizeId: string): Promise<ActionResult> {
  await requireStaff()
  const supabase = await createClient()
  const { data: size } = await supabase.from('product_sizes').select('product_id').eq('id', sizeId).single()
  if (!size) return { ok: false, error: 'Size not found' }
  const { count } = await supabase.from('product_sizes').select('*', { count: 'exact', head: true }).eq('product_id', size.product_id)
  if ((count ?? 0) <= 1) return { ok: false, error: 'A product must keep at least one size' }
  const { error } = await supabase.from('product_sizes').delete().eq('id', sizeId)
  if (error) return { ok: false, error: error.message }
  revalidateTag('catalog')
  return { ok: true }
}
