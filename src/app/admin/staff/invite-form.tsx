'use client'
import { useActionState } from 'react'
import { inviteStaffAction, type InviteState } from './actions'

export function InviteForm() {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(
    inviteStaffAction,
    undefined,
  )

  return (
    <div className="rounded-lg border border-black/10 bg-white p-6">
      <h2 className="mb-4 text-lg font-medium">Invite a staff member</h2>
      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Full name
            <input
              name="full_name"
              type="text"
              required
              autoComplete="off"
              className="rounded-md border border-black/15 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="off"
              className="rounded-md border border-black/15 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Role
            <select
              name="role"
              defaultValue="staff"
              className="rounded-md border border-black/15 px-3 py-2"
            >
              <option value="staff">staff</option>
              <option value="owner">owner</option>
            </select>
          </label>
        </div>

        {state && 'error' in state && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {pending ? 'Inviting…' : 'Send invite'}
          </button>
        </div>
      </form>

      {state && 'ok' in state && (
        <div className="mt-4 rounded-md bg-green-50 p-4 text-sm text-green-800">
          <p className="font-medium">Invited {state.email}.</p>
          <p className="mt-1 text-green-700">
            Share this one-time invite link so they can set a password:
          </p>
          <code className="mt-2 block overflow-x-auto rounded bg-white/70 px-2 py-1 text-xs text-green-900">
            {state.actionLink}
          </code>
        </div>
      )}
    </div>
  )
}
