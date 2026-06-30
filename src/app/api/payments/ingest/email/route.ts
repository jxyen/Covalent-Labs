import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.types'
import { emailPayloadSchema } from '@/lib/payments/ingest/email-schema'
import { parsePaymentEmail } from '@/lib/payments/ingest/adapters/email'
import { toIngestPayload } from '@/lib/payments/ingest/normalize'

export const dynamic = 'force-dynamic'

function authorize(request: Request): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET
  if (!secret) throw new Error('PAYMENT_WEBHOOK_SECRET is not set')
  const got = Buffer.from(request.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

export async function POST(request: Request) {
  let ok: boolean
  try {
    ok = authorize(request)
  } catch {
    return Response.json({ error: 'server misconfigured' }, { status: 500 })
  }
  if (!ok) return Response.json({ error: 'unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  const parsed = emailPayloadSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'invalid payload' }, { status: 400 })

  let event
  try {
    event = parsePaymentEmail(parsed.data)
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 422 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('ingest_payment_event', {
    p_payload: toIngestPayload(event) as Json,
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const result = data as { status: string; order_number: string | null }
  return Response.json({ status: result.status, orderNumber: result.order_number })
}
