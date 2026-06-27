import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export type StaffRow = Database['public']['Tables']['staff']['Row']
export type StaffRole = Database['public']['Enums']['staff_role']
type Client = SupabaseClient<Database>

/** Thrown when a member tries to strip their own owner access (lockout). */
export class LockoutError extends Error {
  constructor(message = 'You cannot lock yourself out of owner access.') {
    super(message)
    this.name = 'LockoutError'
  }
}

/** List all staff, owners first then oldest-created. */
export async function listStaff(client: Client): Promise<StaffRow[]> {
  const { data, error } = await client
    .from('staff')
    .select('*')
    .order('role', { ascending: true }) // 'owner' < 'staff' alphabetically
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Map each auth user id to their `last_sign_in_at` (null until first sign-in).
 * `client` must be a service-role client — only it can read auth users. Used to
 * enrich the staff list; staff rows themselves are read via the RLS client.
 */
export async function getLastSignInMap(client: Client): Promise<Map<string, string | null>> {
  // Tiny team — a single large page covers every admin.
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(error.message)
  return new Map(data.users.map((user) => [user.id, user.last_sign_in_at ?? null]))
}

/** Set the editable profile fields on an existing staff row (UPDATE, never INSERT). */
export async function updateStaffProfile(
  client: Client,
  id: string,
  fields: { full_name?: string | null; role?: StaffRole; active?: boolean },
): Promise<void> {
  const { error } = await client.from('staff').update(fields).eq('id', id)
  if (error) throw new Error(error.message)
}

/** Activate / deactivate a member. An owner may not deactivate themselves. */
export async function setStaffActive(
  client: Client,
  { targetId, active, currentUserId }: { targetId: string; active: boolean; currentUserId: string },
): Promise<void> {
  if (targetId === currentUserId && !active) throw new LockoutError()
  await updateStaffProfile(client, targetId, { active })
}

/** Set a member's role. An owner may not demote themselves out of `owner`. */
export async function setStaffRole(
  client: Client,
  { targetId, role, currentUserId }: { targetId: string; role: StaffRole; currentUserId: string },
): Promise<void> {
  if (targetId === currentUserId && role !== 'owner') throw new LockoutError()
  await updateStaffProfile(client, targetId, { role })
}

/**
 * Invite a new staff member. Two-step:
 *   1. create the Auth user and mint a magic invite link (the member follows
 *      it to set their own password);
 *   2. the on_auth_user_created trigger inserts the staff row — UPDATE it to
 *      set full_name / role / active.
 *
 * Uses `generateLink({ type: 'invite' })` rather than `inviteUserByEmail`: it
 * has identical invite semantics but is not gated by the email-send rate limit,
 * and returns the action link so the caller controls delivery. `client` must be
 * a service-role client. Returns the created auth user and the invite link.
 */
export async function inviteStaff(
  client: Client,
  { email, full_name, role }: { email: string; full_name: string; role: StaffRole },
): Promise<{ id: string; email: string; actionLink: string }> {
  const { data, error } = await client.auth.admin.generateLink({ type: 'invite', email })
  if (error) throw new Error(error.message)
  const user = data.user
  await updateStaffProfile(client, user.id, { full_name, role, active: true })
  return {
    id: user.id,
    email: user.email ?? email,
    actionLink: data.properties.action_link,
  }
}
