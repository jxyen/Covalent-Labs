import { config } from 'dotenv'
config({ path: '.env.local' })

// Node 20 lacks native WebSocket; polyfill before supabase-js initialises
import ws from 'ws'
;(globalThis as unknown as Record<string, unknown>).WebSocket = ws

import { createClient } from '@supabase/supabase-js'
import { SEED_PRODUCTS } from './seed-data'

// Standalone script — create the admin client directly
// (admin.ts has `import 'server-only'` which only works under the Next.js bundler)
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function skuFor(code: string, mg: string): string {
  return `${code}-${mg.replace(/\s+/g, '').toUpperCase()}`
}

async function main() {
  const admin = createAdminClient()

  for (const p of SEED_PRODUCTS) {
    const { data: product, error } = await admin
      .from('products')
      .upsert(
        {
          code: p.code, name: p.name, sub: p.sub, category: p.category,
          image: p.image, mechanism: p.mechanism, tagline: p.tagline,
          purity: p.purity, rating: p.rating, reviews: p.reviews,
          bestseller: p.bestseller, featured: p.featured, blurb: p.blurb,
          compare_at: p.compareAt ?? null,
        },
        { onConflict: 'code' },
      )
      .select()
      .single()
    if (error) throw error

    for (const s of p.sizes) {
      const sku = skuFor(p.code, s.mg)
      const { data: size, error: sErr } = await admin
        .from('product_sizes')
        .upsert(
          { product_id: product.id, mg: s.mg, price: s.price, sku },
          { onConflict: 'sku' },
        )
        .select()
        .single()
      if (sErr) throw sErr

      const { error: iErr } = await admin
        .from('inventory')
        .upsert({ size_id: size.id }, { onConflict: 'size_id' })
      if (iErr) throw iErr
    }
  }

  console.log(`Seeded ${SEED_PRODUCTS.length} products.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
