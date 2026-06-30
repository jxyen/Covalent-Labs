const CUTOFF_HOUR = 14 // 2pm local
const WINDOW_BUSINESS_DAYS = 2

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function nextBusinessDay(d: Date): Date {
  let r = new Date(d)
  while (isWeekend(r)) r = addDays(r, 1)
  return r
}

function addBusinessDays(d: Date, n: number): Date {
  let r = new Date(d)
  let added = 0
  while (added < n) {
    r = addDays(r, 1)
    if (!isWeekend(r)) added++
  }
  return r
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const fmt = (d: Date) =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

/**
 * Human "estimated to be packed" window. Orders before 2pm on a business day
 * pack today; later/weekend orders start the next business day. Window end is
 * 2 business days out. Pure: pass the current Date so it's testable.
 */
export function packEstimate(now: Date): string {
  let start = new Date(now)
  if (start.getHours() >= CUTOFF_HOUR) start = addDays(start, 1)
  start = nextBusinessDay(start)
  const end = addBusinessDays(start, WINDOW_BUSINESS_DAYS)
  const startLabel = sameDay(start, now) ? 'Today' : fmt(start)
  return `${startLabel} – ${fmt(end)}`
}
