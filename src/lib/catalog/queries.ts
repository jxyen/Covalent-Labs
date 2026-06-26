import { unstable_cache } from 'next/cache'
import { createPublicClient } from './client'
import {
  type Product, type Category, type SizeOption,
  productSlug,
} from '@/lib/products'

type Row = {
  code: string; name: string; sub: string | null; category: string
  image: string | null; mechanism: string | null; tagline: string | null
  purity: string | null; rating: number | null; reviews: number | null
  bestseller: boolean; featured: boolean; blurb: string | null
  compare_at: number | null
  product_sizes: { mg: string; price: number }[]
}

function toProduct(r: Row): Product {
  const category = r.category as Category
  const sizes: SizeOption[] = [...r.product_sizes]
    .sort((a, b) => a.price - b.price)
    .map((s) => ({ mg: s.mg, price: Number(s.price) }))
  return {
    code: r.code, name: r.name, sub: r.sub ?? '', category,
    image: r.image ?? '', mechanism: r.mechanism ?? '', tagline: r.tagline ?? '',
    purity: r.purity ?? '', sizes,
    rating: Number(r.rating ?? 0), reviews: r.reviews ?? 0,
    bestseller: r.bestseller, featured: r.featured, blurb: r.blurb ?? '',
    compareAt: r.compare_at ?? undefined,
  }
}

async function fetchCatalog(): Promise<Product[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('products')
    .select('code,name,sub,category,image,mechanism,tagline,purity,rating,reviews,bestseller,featured,blurb,compare_at,product_sizes(mg,price)')
    .eq('active', true)
  if (error) throw error
  return (data as Row[]).map(toProduct)
}

export const getCatalog = unstable_cache(fetchCatalog, ['catalog'], { tags: ['catalog'], revalidate: 3600 })

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  return (await getCatalog()).find((p) => productSlug(p) === slug)
}
export async function getFeatured(): Promise<Product[]> {
  return (await getCatalog()).filter((p) => p.featured)
}
export async function getBestsellers(): Promise<Product[]> {
  return (await getCatalog()).filter((p) => p.bestseller)
}
export async function getRelated(p: Product, n = 3): Promise<Product[]> {
  return (await getCatalog()).filter((x) => x.category === p.category && x.code !== p.code).slice(0, n)
}
