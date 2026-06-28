'use client'
import { useEffect, useState, type ReactNode } from 'react'
import type { Database } from '@/lib/supabase/database.types'

type PaymentStatus = Database['public']['Enums']['payment_status']

export function PaymentStatusWatcher({
  orderNumber,
  initialPaymentStatus,
  pendingPillLabel,
  codeSection,
  pendingBody,
  paidBody,
}: {
  orderNumber: string
  initialPaymentStatus: PaymentStatus
  pendingPillLabel: string
  codeSection: ReactNode
  pendingBody: ReactNode
  paidBody: ReactNode
}) {
  const [paid, setPaid] = useState(initialPaymentStatus === 'paid')

  useEffect(() => {
    if (paid) return
    let polls = 0
    const id = setInterval(async () => {
      if (++polls > 150) return clearInterval(id) // ~10 min cap
      try {
        const res = await fetch(`/api/order/${orderNumber}/status`, { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { paymentStatus: PaymentStatus }
        if (data.paymentStatus === 'paid') {
          setPaid(true)
          clearInterval(id)
        }
      } catch {
        /* transient network error — keep polling */
      }
    }, 4000)
    return () => clearInterval(id)
  }, [orderNumber, paid])

  return (
    <>
      <div className="pill pill-emerald" style={{ marginBottom: 16 }}>
        {paid ? 'Payment received' : pendingPillLabel}
      </div>
      {codeSection}
      {paid ? paidBody : pendingBody}
    </>
  )
}
