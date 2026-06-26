# Dashboard — terminal brief

**Route:** `src/app/admin/page.tsx` (replace the stub — this is the `/admin` landing page)
**Tables you own:** `orders`, `payments`
**Access:** `requireOwner`

## Goal

Build the owner-only analytics dashboard at `/admin`. The dashboard aggregates
revenue and order data from `orders` and `payments` so the owner can see business
performance at a glance. All reads use aggregate queries — no raw PII exposed.
Revenue totals and order counts are broken down by time window (day / week /
month). A top-products view shows which SKUs are selling most.

## Definition of done

- [ ] Revenue totals for current day, week, and month (sum from `payments` where status `paid`)
- [ ] Order counts by status (`pending`, `processing`, `shipped`, `delivered`, `cancelled`)
- [ ] Top products by units sold, derived from `order_items` aggregated over `orders`
- [ ] Time-window selector (day / week / month) that re-queries on change
- [ ] RLS respected (no service-role client in request paths)
- [ ] Tests under `tests/` cover the data-access functions
- [ ] Types regenerated if schema changed
