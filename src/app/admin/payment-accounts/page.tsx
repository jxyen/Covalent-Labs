import { requireOwner } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { AccountsEditor } from './accounts-editor'

export default async function PaymentAccountsPage() {
  await requireOwner()
  const supabase = await createClient()
  const { data } = await supabase
    .from('payment_accounts')
    .select('id, method, handle, display_name, instructions, active, sort_order')
    .order('sort_order')
  return (
    <section>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Payment Accounts</h1>
      <p className="mb-4 text-sm text-black/60">
        Where customers send Zelle / Cash App / Venmo payments. Changes take effect immediately — no deploy.
      </p>
      <AccountsEditor accounts={data ?? []} />
    </section>
  )
}
