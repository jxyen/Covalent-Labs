'use server'
import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireOwner } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  inviteStaff,
  setStaffActive,
  setStaffRole,
  LockoutError,
  type StaffRole,
} from './staff-data'

export type InviteState =
  | { error: string }
  | { ok: true; email: string; actionLink: string }
  | undefined

function isStaffRole(value: string): value is StaffRole {
  return value === 'owner' || value === 'staff'
}

/**
 * Invite a new staff member (owner-only). Creates the Auth user + invite link
 * via the service-role client, then promotes the trigger-created staff row.
 * Returns the invite link so the owner can deliver it.
 */
export async function inviteStaffAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  await requireOwner()

  const email = String(formData.get('email') ?? '').trim()
  const fullName = String(formData.get('full_name') ?? '').trim()
  const role = String(formData.get('role') ?? 'staff')

  if (!email) return { error: 'Email is required.' }
  if (!fullName) return { error: 'Full name is required.' }
  if (!isStaffRole(role)) return { error: 'Invalid role.' }

  const admin = createAdminClient()
  try {
    const invited = await inviteStaff(admin, { email, full_name: fullName, role })
    refresh() // re-render the server component so the new member shows in the table
    return { ok: true, email: invited.email, actionLink: invited.actionLink }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to invite staff member.' }
  }
}

/** Set a member's role (owner-only). Guards against self-demotion. */
export async function setRoleAction(formData: FormData): Promise<void> {
  const me = await requireOwner()
  const targetId = String(formData.get('id') ?? '')
  const role = String(formData.get('role') ?? '')
  if (!targetId || !isStaffRole(role)) redirect('/admin/staff?error=invalid')

  const supabase = await createClient()
  try {
    await setStaffRole(supabase, { targetId, role, currentUserId: me.id })
  } catch (err) {
    if (err instanceof LockoutError) redirect('/admin/staff?error=lockout')
    throw err
  }
  refresh() // refresh the client router so the updated role shows without a manual reload
}

/** Activate / deactivate a member (owner-only). Guards against self-deactivation. */
export async function setActiveAction(formData: FormData): Promise<void> {
  const me = await requireOwner()
  const targetId = String(formData.get('id') ?? '')
  const active = String(formData.get('active') ?? '') === 'true'
  if (!targetId) redirect('/admin/staff?error=invalid')

  const supabase = await createClient()
  try {
    await setStaffActive(supabase, { targetId, active, currentUserId: me.id })
  } catch (err) {
    if (err instanceof LockoutError) redirect('/admin/staff?error=lockout')
    throw err
  }
  refresh() // refresh the client router so the status change shows without a manual reload
}
