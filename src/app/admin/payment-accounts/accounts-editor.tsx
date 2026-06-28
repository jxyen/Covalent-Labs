'use client'
import { useState } from 'react'
import { updatePaymentAccount } from './actions'

type Account = {
  id: string
  method: string
  handle: string
  display_name: string
  instructions: string | null
  active: boolean
  sort_order: number
}

export function AccountsEditor({ accounts }: { accounts: Account[] }) {
  return (
    <div className="flex flex-col gap-4">
      {accounts.map((a) => (
        <Row key={a.id} account={a} />
      ))}
    </div>
  )
}

function Row({ account }: { account: Account }) {
  const [handle, setHandle] = useState(account.handle)
  const [active, setActive] = useState(account.active)
  const [msg, setMsg] = useState('')
  async function save() {
    const r = await updatePaymentAccount(account.id, {
      handle,
      display_name: account.display_name,
      instructions: account.instructions ?? undefined,
      active,
      sort_order: account.sort_order,
    })
    setMsg(r.ok ? 'Saved' : r.error)
  }
  return (
    <div className="flex items-center gap-3 rounded-lg border border-black/10 p-3">
      <span className="w-20 text-sm font-medium capitalize">{account.method}</span>
      <input
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm"
        placeholder="$handle / email / @user"
      />
      <label className="flex items-center gap-1 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> active
      </label>
      <button onClick={save} className="rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5">
        Save
      </button>
      {msg && <span className="text-xs text-black/50">{msg}</span>}
    </div>
  )
}
