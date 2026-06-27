import { setRoleAction, setActiveAction } from './actions'
import type { StaffRow } from './staff-data'

type Member = StaffRow & { last_sign_in_at: string | null }

function formatSignIn(iso: string | null) {
  if (!iso) return 'never'
  return new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function StaffTable({
  members,
  currentUserId,
}: {
  members: Member[]
  currentUserId: string
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-black/10">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-black/10 bg-neutral-50 text-xs uppercase tracking-wide text-black/50">
          <tr>
            <th className="px-4 py-3 font-medium">Member</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Last sign-in</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {members.map((m) => {
            const isSelf = m.id === currentUserId
            return (
              <tr key={m.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {m.full_name ?? '—'}
                    {isSelf && <span className="ml-2 text-xs text-black/40">(you)</span>}
                  </div>
                  <div className="text-xs text-black/50">{m.email}</div>
                </td>

                <td className="px-4 py-3">
                  <form action={setRoleAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    <select
                      // include role in the key so a soft refresh remounts the
                      // (uncontrolled) select and it picks up the new defaultValue
                      key={`${m.id}-${m.role}`}
                      name="role"
                      defaultValue={m.role}
                      disabled={isSelf}
                      className="rounded-md border border-black/15 px-2 py-1 text-sm disabled:opacity-50"
                    >
                      <option value="staff">staff</option>
                      <option value="owner">owner</option>
                    </select>
                    <button
                      type="submit"
                      disabled={isSelf}
                      title={isSelf ? 'You can’t change your own role' : undefined}
                      className="rounded-md border border-black/15 px-2 py-1 text-xs disabled:opacity-40"
                    >
                      Save
                    </button>
                  </form>
                </td>

                <td className="px-4 py-3">
                  <span
                    className={
                      m.active
                        ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800'
                        : 'rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-black/60'
                    }
                  >
                    {m.active ? 'active' : 'inactive'}
                  </span>
                </td>

                <td className="px-4 py-3 text-black/60">{formatSignIn(m.last_sign_in_at)}</td>

                <td className="px-4 py-3">
                  <form action={setActiveAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="active" value={m.active ? 'false' : 'true'} />
                    <button
                      type="submit"
                      disabled={isSelf && m.active}
                      title={
                        isSelf && m.active ? 'You can’t deactivate yourself' : undefined
                      }
                      className="rounded-md border border-black/15 px-3 py-1 text-xs disabled:opacity-40"
                    >
                      {m.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </form>
                </td>
              </tr>
            )
          })}
          {members.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-black/50">
                No staff members yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
