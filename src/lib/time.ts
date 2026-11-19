/** Helpers for "HH:mm" times and minute counts. */

export const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export const fromMinutes = (minutes: number): string => {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** "14:30" or "2:30 PM", following the device's settings. */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** "14:30–15:30" */
export function formatRange(time: string, duration = 60): string {
  const end = Math.min(24 * 60, toMinutes(time) + duration)
  const endLabel = end >= 24 * 60 ? formatTime('23:59') : formatTime(fromMinutes(end))
  return `${formatTime(time)}–${endLabel}`
}

/** "45 min", "1 h", "1 h 30 min" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

export const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240]

/** Short hour label for the time grid: "7 AM" on 12-hour devices, "07:00" on 24-hour ones. */
export function formatHour(hour: number): string {
  const sample = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions()
  const twelve = sample.hourCycle === 'h11' || sample.hourCycle === 'h12'
  if (!twelve) return `${String(hour).padStart(2, '0')}:00`
  return new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, { hour: 'numeric' })
}
