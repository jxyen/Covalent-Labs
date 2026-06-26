'use client'
import { useActionState } from 'react'
import { login } from '../actions'

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined)
  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input name="email" type="email" autoComplete="email" required
          className="rounded-md border border-black/15 px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input name="password" type="password" autoComplete="current-password" required
          className="rounded-md border border-black/15 px-3 py-2" />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">{state.error}</p>
      )}
      <button type="submit" disabled={pending}
        className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50">
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
