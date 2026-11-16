/** Date helpers working on local-time "YYYY-MM-DD" keys. */

export function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayKey(): string {
  return toKey(new Date())
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

export function diffDays(a: string, b: string): number {
  return Math.round((fromKey(a).getTime() - fromKey(b).getTime()) / 86_400_000)
}

/** Monday of the week containing `key`. */
export function startOfWeek(key: string): string {
  const d = fromKey(key)
  const offset = (d.getDay() + 6) % 7
  return addDays(key, -offset)
}

export function nextSaturday(key: string): string {
  const d = fromKey(key)
  const offset = (6 - d.getDay() + 7) % 7
  return addDays(key, offset === 0 ? 7 : offset)
}

export function nextMonday(key: string): string {
  return addDays(startOfWeek(key), 7)
}

const SHORT: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

/** Friendly label: Today, Tomorrow, Yesterday, weekday within a week, else "Nov 16". */
export function relativeLabel(key: string, today = todayKey()): string {
  const diff = diffDays(key, today)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  const d = fromKey(key)
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' })
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === fromKey(today).getFullYear() ? SHORT : { ...SHORT, year: 'numeric' }
  return d.toLocaleDateString(undefined, opts)
}

export function longDate(key: string): string {
  return fromKey(key).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
}

export function weekday(key: string, style: 'long' | 'short' | 'narrow' = 'long'): string {
  return fromKey(key).toLocaleDateString(undefined, { weekday: style })
}

export function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString(undefined, SHORT)
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
