// Plain module (NOT 'use server'): zod schema + type for a forwarded payment
// receipt email. A bridge (e.g. a Gmail filter → Apps Script) POSTs this shape
// to /api/payments/ingest/email.
import { z } from 'zod'

export const emailPayloadSchema = z.object({
  from: z.string().min(1),         // sender, e.g. "Venmo <venmo@venmo.com>"
  subject: z.string().default(''),
  text: z.string().default(''),    // plain-text body
  receivedAt: z.string().optional(), // ISO timestamp from the email Date header
  messageId: z.string().optional(),  // RFC Message-ID — stable per email, used for dedup
})

export type EmailPayload = z.infer<typeof emailPayloadSchema>
