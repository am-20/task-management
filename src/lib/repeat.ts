import { addDays, fromKey, toKey } from './date'
import type { Repeat, RepeatUnit } from '../types'

/* ---------- Calendar arithmetic ---------- */

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/** Add months, clamping the day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(key: string, n: number, day?: number): string {
  const d = fromKey(key)
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const want = day ?? d.getDate()
  target.setDate(Math.min(want, daysInMonth(target.getFullYear(), target.getMonth())))
  return toKey(target)
}

function addUnits(key: string, unit: RepeatUnit, n: number): string {
  if (unit === 'day') return addDays(key, n)
  if (unit === 'week') return addDays(key, n * 7)
  if (unit === 'month') return addMonths(key, n)
  return addMonths(key, n * 12)
}

/** A running week number (weeks start on Monday), so two dates' weeks can be compared. */
function weekIndex(key: string): number {
  const d = fromKey(key)
  const days = Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)
  // 1 Jan 1970 was a Thursday, so day 4 is the first Monday.
  return Math.floor((days - 4) / 7)
}

/** The nth (1–4) or last (-1) given weekday of a month. */
function nthWeekday(year: number, month: number, weekday: number, nth: number): string {
  if (nth === -1) {
    const last = new Date(year, month, daysInMonth(year, month))
    last.setDate(last.getDate() - ((last.getDay() - weekday + 7) % 7))
    return toKey(last)
  }
  const first = new Date(year, month, 1)
  const offset = (weekday - first.getDay() + 7) % 7
  return toKey(new Date(year, month, 1 + offset + (nth - 1) * 7))
}

/* ---------- Occurrences ---------- */

/** Which occurrence of the month a date is: 1–4, or 5 when it is in the fifth week. */
export function weekOfMonth(key: string): number {
  return Math.ceil(fromKey(key).getDate() / 7)
}

export function isLastWeekOfMonth(key: string): boolean {
  const d = fromKey(key)
  return d.getDate() + 7 > daysInMonth(d.getFullYear(), d.getMonth())
}

export function isLastDayOfMonth(key: string): boolean {
  const d = fromKey(key)
  return d.getDate() === daysInMonth(d.getFullYear(), d.getMonth())
}

/** The date in a given month that a monthly rule lands on. */
function monthlyDate(rule: Repeat, year: number, month: number, fallbackDay: number): string {
  if (rule.monthBy === 'weekday' && rule.weekday !== undefined && rule.nth !== undefined) {
    return nthWeekday(year, month, rule.weekday, rule.nth)
  }
  const dim = daysInMonth(year, month)
  const day = rule.monthDay === -1 ? dim : Math.min(rule.monthDay ?? fallbackDay, dim)
  return toKey(new Date(year, month, day))
}

const MAX_STEPS = 2000

/**
 * The first date strictly after `after` on the schedule that runs through `from`
 * (the current occurrence's date). Ignores `until` and `count`.
 */
export function nextOnSchedule(rule: Repeat, from: string, after: string): string {
  const every = Math.max(1, Math.floor(rule.every) || 1)
  const floor = after > from ? after : from

  if (rule.unit === 'day') {
    const gap = Math.round((fromKey(floor).getTime() - fromKey(from).getTime()) / 86_400_000)
    const steps = Math.floor(gap / every) + 1
    return addDays(from, steps * every)
  }

  if (rule.unit === 'week') {
    const days = rule.weekdays?.length ? rule.weekdays : [fromKey(from).getDay()]
    const startWeek = weekIndex(from)
    const gap = Math.round((fromKey(floor).getTime() - fromKey(from).getTime()) / 86_400_000)
    let cursor = addDays(floor, 1)
    for (let i = 0; i < gap + every * 14 + 7; i++) {
      const offset = weekIndex(cursor) - startWeek
      if (offset % every === 0 && days.includes(fromKey(cursor).getDay())) return cursor
      cursor = addDays(cursor, 1)
    }
    return addDays(floor, 1)
  }

  const start = fromKey(from)
  const months = rule.unit === 'year' ? 12 * every : every
  for (let i = 1; i <= MAX_STEPS; i++) {
    const m = new Date(start.getFullYear(), start.getMonth() + i * months, 1)
    const candidate =
      rule.unit === 'year'
        ? toKey(new Date(m.getFullYear(), m.getMonth(), Math.min(start.getDate(), daysInMonth(m.getFullYear(), m.getMonth()))))
        : monthlyDate(rule, m.getFullYear(), m.getMonth(), start.getDate())
    if (candidate > floor) return candidate
  }
  return addUnits(floor, rule.unit, every)
}

/**
 * When a repeating task is finished: the due date of the next occurrence, or null when
 * the series is over. Late tasks move to the next date after today rather than piling up.
 */
export function nextDue(rule: Repeat, due: string, today: string): string | null {
  const every = Math.max(1, Math.floor(rule.every) || 1)
  const next = rule.fromCompletion
    ? addUnits(today, rule.unit, every)
    : nextOnSchedule(rule, due, today > due ? today : due)
  if (rule.until && next > rule.until) return null
  if (rule.count && (rule.occurrence ?? 1) >= rule.count) return null
  return next
}

/** Future dates of a series between two dates (inclusive), for the calendar. */
export function upcomingDates(rule: Repeat, due: string, start: string, end: string, limit = 62): string[] {
  if (rule.fromCompletion) return []
  const out: string[] = []
  let current = due
  let occurrence = rule.occurrence ?? 1
  for (let i = 0; i < 1000 && out.length < limit; i++) {
    if (rule.count && occurrence >= rule.count) break
    const next = nextOnSchedule(rule, current, current)
    if (next > end || (rule.until && next > rule.until)) break
    occurrence++
    if (next >= start) out.push(next)
    current = next
  }
  return out
}

/* ---------- Words ---------- */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const NTH = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', [-1]: 'last' } as Record<number, string>

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export const dayName = (d: number) => DAY_NAMES[d]

/** A short, friendly description such as "Every Mon, Wed" or "Monthly on the 2nd Tuesday". */
export function describeRepeat(rule: Repeat, short = false): string {
  const n = Math.max(1, rule.every)
  const unitWord = { day: 'day', week: 'week', month: 'month', year: 'year' }[rule.unit]
  const every = n === 1 ? `Every ${unitWord}` : `Every ${n} ${unitWord}s`
  let text: string

  if (rule.fromCompletion) {
    text = `${every} after done`
  } else if (rule.unit === 'day') {
    text = n === 1 ? 'Daily' : every
  } else if (rule.unit === 'week') {
    const days = [...(rule.weekdays ?? [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    const weekdays = days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))
    const weekend = days.length === 2 && days.includes(0) && days.includes(6)
    const list = weekdays
      ? 'weekdays'
      : weekend
        ? 'weekends'
        : days.length === 7
          ? 'day'
          : days.map((d) => (days.length > 1 || short ? DAY_SHORT[d] : DAY_NAMES[d])).join(', ')
    if (n === 1 && weekdays) text = 'Weekdays'
    else if (n === 1 && weekend) text = 'Weekends'
    else text = `${n === 1 ? 'Every' : `Every ${n} weeks on`} ${list}`
  } else if (rule.unit === 'month') {
    const on =
      rule.monthBy === 'weekday' && rule.weekday !== undefined
        ? `the ${NTH[rule.nth ?? 1]} ${DAY_NAMES[rule.weekday]}`
        : rule.monthDay === -1
          ? 'the last day'
          : `the ${ordinal(rule.monthDay ?? 1)}`
    text = `${n === 1 ? 'Monthly' : every} on ${on}`
  } else {
    text = n === 1 ? 'Yearly' : every
  }

  if (!short) {
    if (rule.until) text += `, until ${fromKey(rule.until).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    else if (rule.count) text += `, ${rule.count} times`
  }
  return text
}

/** Ready-made choices based on the task's date, like a calendar app offers. */
export function presets(due: string): { label: string; rule: Repeat }[] {
  const d = fromKey(due)
  const wd = d.getDay()
  const out: { label: string; rule: Repeat }[] = [
    { label: 'Every day', rule: { every: 1, unit: 'day' } },
    { label: 'Every weekday (Mon–Fri)', rule: { every: 1, unit: 'week', weekdays: [1, 2, 3, 4, 5] } },
    { label: `Every week on ${DAY_NAMES[wd]}`, rule: { every: 1, unit: 'week', weekdays: [wd] } },
    { label: `Every 2 weeks on ${DAY_NAMES[wd]}`, rule: { every: 2, unit: 'week', weekdays: [wd] } },
    { label: `Every month on the ${ordinal(d.getDate())}`, rule: { every: 1, unit: 'month', monthBy: 'day', monthDay: d.getDate() } },
  ]
  const nth = weekOfMonth(due)
  if (nth <= 4) {
    out.push({
      label: `Every month on the ${NTH[nth]} ${DAY_NAMES[wd]}`,
      rule: { every: 1, unit: 'month', monthBy: 'weekday', nth, weekday: wd },
    })
  }
  if (isLastWeekOfMonth(due)) {
    out.push({
      label: `Every month on the last ${DAY_NAMES[wd]}`,
      rule: { every: 1, unit: 'month', monthBy: 'weekday', nth: -1, weekday: wd },
    })
  }
  if (isLastDayOfMonth(due)) {
    out.push({ label: 'Every month on the last day', rule: { every: 1, unit: 'month', monthBy: 'day', monthDay: -1 } })
  }
  out.push({
    label: `Every year on ${d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`,
    rule: { every: 1, unit: 'year' },
  })
  return out
}

/** Keep only valid fields from stored or imported data. */
export function cleanRepeat(raw: unknown): Repeat | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Partial<Repeat>
  if (!['day', 'week', 'month', 'year'].includes(r.unit as string)) return undefined
  const int = (v: unknown, min: number, max: number) => {
    const n = Math.floor(Number(v))
    return Number.isFinite(n) && n >= min && n <= max ? n : undefined
  }
  const out: Repeat = { every: int(r.every, 1, 999) ?? 1, unit: r.unit as RepeatUnit }
  if (r.unit === 'week') {
    const days = Array.isArray(r.weekdays) ? [...new Set(r.weekdays.map((d) => int(d, 0, 6)).filter((d) => d !== undefined))] : []
    if (days.length) out.weekdays = days as number[]
  }
  if (r.unit === 'month') {
    out.monthBy = r.monthBy === 'weekday' ? 'weekday' : 'day'
    if (out.monthBy === 'weekday') {
      out.nth = r.nth === -1 ? -1 : (int(r.nth, 1, 4) ?? 1)
      out.weekday = int(r.weekday, 0, 6) ?? 1
    } else {
      out.monthDay = r.monthDay === -1 ? -1 : (int(r.monthDay, 1, 31) ?? 1)
    }
  }
  if (r.fromCompletion) out.fromCompletion = true
  if (typeof r.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.until)) out.until = r.until
  const count = int(r.count, 1, 9999)
  if (count) out.count = count
  const occurrence = int(r.occurrence, 1, 99999)
  if (occurrence) out.occurrence = occurrence
  return out
}

/** The first date on or after `from` that the rule allows (used when a repeat is first set). */
export function firstOnOrAfter(rule: Repeat, from: string): string {
  if (rule.fromCompletion || rule.unit === 'day' || rule.unit === 'year') return from
  if (rule.unit === 'week') {
    const days = rule.weekdays?.length ? rule.weekdays : [fromKey(from).getDay()]
    for (let i = 0; i < 7; i++) {
      const k = addDays(from, i)
      if (days.includes(fromKey(k).getDay())) return k
    }
    return from
  }
  const d = fromKey(from)
  const here = monthlyDate(rule, d.getFullYear(), d.getMonth(), d.getDate())
  if (here >= from) return here
  return monthlyDate(rule, d.getFullYear(), d.getMonth() + 1, d.getDate())
}
