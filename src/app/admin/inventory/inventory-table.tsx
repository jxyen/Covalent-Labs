'use client'
import { useActionState, useEffect, useState, useTransition } from 'react'
import {
  restockAction,
  adjustAction,
  fetchMovementsAction,
  type ActionState,
} from './actions'
import type { InventoryRow, Movement } from '@/lib/admin/inventory'

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <div className="overflow-hidden rounded-lg border border-black/10">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-black/50">
          <tr>
            <th className="px-4 py-2 font-medium">SKU</th>
            <th className="px-4 py-2 font-medium">Product</th>
            <th className="px-4 py-2 font-medium text-right">On hand</th>
            <th className="px-4 py-2 font-medium text-right">Reorder @</th>
            <th className="px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row
              key={r.sizeId}
              row={r}
              open={openId === r.sizeId}
              onToggle={() => setOpenId(openId === r.sizeId ? null : r.sizeId)}
            />
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-black/50">
                No SKUs yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Row({
  row,
  open,
  onToggle,
}: {
  row: InventoryRow
  open: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        aria-expanded={open}
        className={`cursor-pointer border-t border-black/5 ${
          row.lowStock ? 'bg-amber-50' : ''
        } hover:bg-black/[0.02]`}
      >
        <td className="px-4 py-2 font-mono text-xs">{row.sku}</td>
        <td className="px-4 py-2">
          {row.productName} <span className="text-black/40">{row.mg}</span>
        </td>
        <td className="px-4 py-2 text-right tabular-nums">{row.quantityOnHand}</td>
        <td className="px-4 py-2 text-right tabular-nums text-black/50">
          {row.reorderThreshold}
        </td>
        <td className="px-4 py-2">
          {row.lowStock ? (
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              LOW
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-black/50">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              OK
            </span>
          )}
        </td>
      </tr>
      {open && (
        <tr className="border-t border-black/5 bg-neutral-50/60">
          <td colSpan={5} className="px-4 py-4">
            <div className="grid gap-6 md:grid-cols-[1fr_1fr_1.2fr]">
              <RestockForm sizeId={row.sizeId} />
              <AdjustForm sizeId={row.sizeId} />
              <History sizeId={row.sizeId} open={open} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function RestockForm({ sizeId }: { sizeId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(restockAction, {})
  return (
    <form action={action} className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-black/50">Restock</p>
      <input type="hidden" name="sizeId" value={sizeId} />
      <input
        name="qty"
        type="number"
        min={1}
        step={1}
        required
        placeholder="Qty"
        className="w-full rounded border border-black/15 px-2 py-1"
      />
      <button
        disabled={pending}
        className="rounded bg-black px-3 py-1 text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Restock'}
      </button>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state.ok && <p className="text-xs text-emerald-700">Stock updated.</p>}
    </form>
  )
}

function AdjustForm({ sizeId }: { sizeId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(adjustAction, {})
  return (
    <form action={action} className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-black/50">Adjust</p>
      <input type="hidden" name="sizeId" value={sizeId} />
      <input
        name="delta"
        type="number"
        step={1}
        required
        placeholder="± Qty (e.g. -2)"
        className="w-full rounded border border-black/15 px-2 py-1"
      />
      <input
        name="note"
        type="text"
        required
        placeholder="Reason / note"
        className="w-full rounded border border-black/15 px-2 py-1"
      />
      <button
        disabled={pending}
        className="rounded bg-black px-3 py-1 text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Apply'}
      </button>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state.ok && <p className="text-xs text-emerald-700">Adjusted.</p>}
    </form>
  )
}

function History({ sizeId, open }: { sizeId: string; open: boolean }) {
  const [moves, setMoves] = useState<Movement[] | null>(null)
  const [, startTransition] = useTransition()
  useEffect(() => {
    if (!open) return
    startTransition(async () => {
      setMoves(await fetchMovementsAction(sizeId))
    })
  }, [open, sizeId])
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-black/50">History</p>
      {moves === null && <p className="text-xs text-black/40">Loading…</p>}
      {moves?.length === 0 && <p className="text-xs text-black/40">No movements yet.</p>}
      <ul className="space-y-1">
        {moves?.map((m) => (
          <li key={m.id} className="flex items-baseline gap-2 text-xs">
            <span
              className={`font-mono ${m.delta < 0 ? 'text-red-600' : 'text-emerald-700'}`}
            >
              {m.delta > 0 ? `+${m.delta}` : m.delta}
            </span>
            <span className="text-black/60">{m.reason}</span>
            {m.note && <span className="text-black/40">“{m.note}”</span>}
            <span className="ml-auto text-black/30">
              {new Date(m.createdAt).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
