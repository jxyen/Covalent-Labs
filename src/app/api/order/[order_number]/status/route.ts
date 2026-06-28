import { getOrderForPayment } from '@/lib/orders/queries'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ order_number: string }> },
) {
  const { order_number } = await params
  const order = await getOrderForPayment(order_number)
  if (!order) return Response.json({ error: 'not found' }, { status: 404 })
  return Response.json(
    { paymentStatus: order.paymentStatus, status: order.status },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
