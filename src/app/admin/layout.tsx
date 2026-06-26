import { getCurrentStaff } from '@/lib/auth/dal'
import { AdminNav } from './admin-nav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff()

  // Unauthenticated (e.g. the /admin/login route): render bare. Proxy guards the rest.
  if (!staff || !staff.active) return <>{children}</>

  return (
    <div className="flex min-h-screen">
      <AdminNav staff={staff} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
