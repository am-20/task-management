import { addDays, fromKey, toKey } from './date'
import type { Habit } from '../types'

const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Whether the habit is meant to happen on this day. No schedule means every day. */
export function isScheduled(habit: Habit, day: string): boolean {
  if (!habit.days || habit.days.length === 0 || habit.days.length === 7) return true
  return habit.days.includes(fromKey(day).getDay())
}

/** "Every day", "Weekdays", "Mon, Wed, Fri" … */
export function scheduleLabel(habit: Habit): string {
  const days = habit.days
  if (!days || days.length === 0 || days.length === 7) return 'Every day'
  const sorted = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  if (sorted.length === 5 && [1, 2, 3, 4, 5].every((d) => sorted.includes(d))) return 'Weekdays'
  if (sorted.length === 2 && sorted.includes(0) && sorted.includes(6)) return 'Weekends'
  return sorted.map((d) => SHORT[d]).join(', ')
}

/** The first day the habit existed: when it was made, or its earliest tick if older. */
export function habitStart(habit: Habit): string {
  const created = toKey(new Date(habit.createdAt))
  const earliest = Object.keys(habit.log).sort()[0]
  return earliest && earliest < created ? earliest : created
}

/**
 * How many scheduled days in a row were done, counting back from today.
 * Rest days are skipped (they neither break nor add to the run), and today
 * doesn't break the run while it's still open.
 */
export function habitStreak(habit: Habit, today: string): number {
  const start = habitStart(habit)
  let cursor = today
  let streak = 0
  if (!habit.log[today]) cursor = addDays(today, -1)
  for (let i = 0; i < 3660 && cursor >= start; i++) {
    if (isScheduled(habit, cursor)) {
      if (!habit.log[cursor]) break
      streak++
    }
    cursor = addDays(cursor, -1)
  }
  return streak
}
