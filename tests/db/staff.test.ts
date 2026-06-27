import { describe, it, expect, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  listStaff,
  getLastSignInMap,
  updateStaffProfile,
  setStaffActive,
  setStaffRole,
  inviteStaff,
  LockoutError,
} from '@/app/admin/staff/staff-data'
import type { Database } from '@/lib/supabase/database.types'

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

describe('staff data access', () => {
  const admin: SupabaseClient<Database> = createClient<Database>(url, service, {
    auth: { persistSession: false },
  })
  const createdUserIds: string[] = []

  afterAll(async () => {
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => {})
    }
  })

  // Create a real auth user; the on_auth_user_created trigger inserts the
  // matching staff row (inactive, role 'staff'). Returns the new id + email.
  async function newMember(prefix: string) {
    const email = `${prefix}-${crypto.randomUUID()}@test.local`
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: `Pw-${crypto.randomUUID()}`,
      email_confirm: true,
    })
    if (error) throw error
    const id = data.user.id
    createdUserIds.push(id)
    return { id, email }
  }

  it('listStaff returns created members', async () => {
    const { id } = await newMember('list')
    const rows = await listStaff(admin)
    expect(rows.find((r) => r.id === id)).toBeTruthy()
  })

  it('getLastSignInMap maps each auth user id to a last-sign-in (null until they sign in)', async () => {
    const { id } = await newMember('lastsignin')
    const map = await getLastSignInMap(admin)
    expect(map.has(id)).toBe(true)
    expect(map.get(id)).toBeNull() // freshly created, never signed in
  })

  it('updateStaffProfile updates the trigger-created row in place (never a 2nd insert)', async () => {
    const { id } = await newMember('update')
    await updateStaffProfile(admin, id, { full_name: 'Jane Doe', role: 'owner', active: true })
    const { data } = await admin.from('staff').select('*').eq('id', id)
    expect(data).toHaveLength(1) // proves UPDATE, not a blind INSERT
    expect(data![0]).toMatchObject({ full_name: 'Jane Doe', role: 'owner', active: true })
  })

  it('setStaffActive activates and deactivates another member', async () => {
    const target = await newMember('active')
    const me = await newMember('me-active')
    await setStaffActive(admin, { targetId: target.id, active: true, currentUserId: me.id })
    let { data } = await admin.from('staff').select('active').eq('id', target.id).single()
    expect(data!.active).toBe(true)
    await setStaffActive(admin, { targetId: target.id, active: false, currentUserId: me.id })
    ;({ data } = await admin.from('staff').select('active').eq('id', target.id).single())
    expect(data!.active).toBe(false)
  })

  it('setStaffActive throws LockoutError when an owner deactivates themselves', async () => {
    const me = await newMember('self-deactivate')
    await updateStaffProfile(admin, me.id, { full_name: 'Me', role: 'owner', active: true })
    await expect(
      setStaffActive(admin, { targetId: me.id, active: false, currentUserId: me.id }),
    ).rejects.toBeInstanceOf(LockoutError)
    const { data } = await admin.from('staff').select('active').eq('id', me.id).single()
    expect(data!.active).toBe(true) // unchanged
  })

  it('setStaffRole sets the role for another member', async () => {
    const target = await newMember('role')
    const me = await newMember('me-role')
    await setStaffRole(admin, { targetId: target.id, role: 'owner', currentUserId: me.id })
    const { data } = await admin.from('staff').select('role').eq('id', target.id).single()
    expect(data!.role).toBe('owner')
  })

  it('setStaffRole throws LockoutError when an owner demotes themselves', async () => {
    const me = await newMember('self-demote')
    await updateStaffProfile(admin, me.id, { full_name: 'Me', role: 'owner', active: true })
    await expect(
      setStaffRole(admin, { targetId: me.id, role: 'staff', currentUserId: me.id }),
    ).rejects.toBeInstanceOf(LockoutError)
    const { data } = await admin.from('staff').select('role').eq('id', me.id).single()
    expect(data!.role).toBe('owner') // unchanged
  })

  it('inviteStaff creates an auth user and promotes the trigger-created row', async () => {
    // inviteUserByEmail validates the domain more strictly than createUser,
    // so use a real reserved TLD (RFC 2606) rather than `.test.local`.
    const email = `invite-${crypto.randomUUID()}@example.com`
    const user = await inviteStaff(admin, { email, full_name: 'Invited Person', role: 'owner' })
    createdUserIds.push(user.id)
    const { data } = await admin.from('staff').select('*').eq('id', user.id)
    expect(data).toHaveLength(1)
    expect(data![0]).toMatchObject({
      email,
      full_name: 'Invited Person',
      role: 'owner',
      active: true,
    })
  })
})
