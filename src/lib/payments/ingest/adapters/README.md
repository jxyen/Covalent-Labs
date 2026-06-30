# Ingestion adapters

Each adapter turns one detection channel's raw payload into a
`NormalizedPaymentEvent` (`../normalize.ts`). The webhook route for the channel
authenticates, validates the raw payload, calls the adapter, then
`toIngestPayload()` → `ingest_payment_event` RPC. The matching engine is
channel-agnostic, so adding a channel never touches the SQL.

## Current
- `push.ts` — Android push-notification forwarder. Input `PushPayload`
  (`{ app, title, text, postedAt? }`); maps package→method, parses amount + sender.
- `email.ts` — forwarded payment receipt email. Input `EmailPayload`
  (`{ from, subject, text, receivedAt?, messageId? }`); detects method by sender
  domain (Venmo/Cash App) or keyword (Zelle, via the customer's bank), parses
  amount + sender, uses `messageId` as `externalId`, and keeps `subject + body`
  as `rawText` so a `KL-` order code survives for the code-match path.

## Adding a channel (e.g. email, Plaid)
1. Add `<channel>-schema.ts` (zod) for the raw payload.
2. Add `adapters/<channel>.ts` exporting
   `parse<Channel>(payload): NormalizedPaymentEvent` with `channel: '<channel>'`.
3. Add `src/app/api/payments/ingest/<channel>/route.ts` mirroring the push route
   (Bearer auth → validate → adapter → `toIngestPayload` → RPC).
4. Unit-test the adapter; the engine + DB tests already cover matching.
