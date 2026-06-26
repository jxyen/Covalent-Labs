import Link from 'next/link'
import { ADMIN_SECTIONS } from '@/lib/admin/sections'
import { signOut } from './actions'
import type { Staff } from '@/lib/auth/dal'

export function AdminNav({ staff }: { staff: Staff }) {
  const visible = ADMIN_SECTIONS.filter((s) => !s.ownerOnly || staff.role === 'owner')
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-black/10 bg-neutral-50 p-4">
      <div className="mb-6 text-sm font-semibold tracking-tight">Kairo Labs Admin</div>
      <nav className="flex flex-col gap-1 text-sm">
        {visible.map((s) => (
          <Link key={s.slug}
            href={s.slug === 'dashboard' ? '/admin' : `/admin/${s.slug}`}
            className="rounded-md px-3 py-2 hover:bg-black/5">
            {s.label}
          </Link>
        ))}
      </nav>
      <form action={signOut} className="mt-auto pt-4">
        <div className="mb-2 text-xs text-black/50">{staff.email} · {staff.role}</div>
        <button className="w-full rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5">
          Sign out
        </button>
      </form>
    </aside>
  )
}
