import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!

describe('staff table', () => {
  it('exists and is readable by the service role', async () => {
    const admin = createClient(url, service, { auth: { persistSession: false } })
    const { error } = await admin.from('staff').select('id').limit(1)
    expect(error).toBeNull()
  })

  it('denies anonymous reads (RLS on)', async () => {
    const anonClient = createClient(url, anon, { auth: { persistSession: false } })
    const { data } = await anonClient.from('staff').select('id')
    expect(data ?? []).toHaveLength(0)
  })
})
