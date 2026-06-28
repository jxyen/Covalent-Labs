'use server'
import { z } from 'zod'
import { requireOwner } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  handle: z.string().min(1, 'Handle is required'),
  display_name: z.string().min(1),
  instructions: z.string().optional(),
  active: z.boolean(),
  sort_order: z.number().int(),
})
export type AccountResult = { ok: true } | { ok: false; error: string }

export async function updatePaymentAccount(id: string, input: z.infer<typeof schema>): Promise<AccountResult> {
  await requireOwner()
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('payment_accounts')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}
