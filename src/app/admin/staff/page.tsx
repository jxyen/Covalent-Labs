import { requireOwner } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listStaff, getLastSignInMap } from './staff-data'
import { InviteForm } from './invite-form'
import { StaffTable } from './staff-table'

export const metadata = { title: 'Staff · Kairo Labs Admin' }

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const me = await requireOwner()

  // Staff rows via the RLS client (owner policy); last-sign-in via the
  // service-role Auth admin API — both behind requireOwner(), server-side only.
  const supabase = await createClient()
  const rows = await listStaff(supabase)
  const lastSignIn = await getLastSignInMap(createAdminClient())
  const members = rows.map((row) => ({
    ...row,
    last_sign_in_at: lastSignIn.get(row.id) ?? null,
  }))

  const { error } = await searchParams

  return (
    <section className="flex flex-col gap-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
        <span className="text-sm text-black/50">{members.length} members</span>
      </header>

      {error === 'lockout' && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          You can’t remove your own owner access.
        </p>
      )}
      {error === 'invalid' && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          That request was invalid.
        </p>
      )}

      <InviteForm />
      <StaffTable members={members} currentUserId={me.id} />
    </section>
  )
}
