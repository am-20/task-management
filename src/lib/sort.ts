import type { Task } from '../types'

/** Sort by due date (undated last), then by creation order. */
export function byDue(a: Task, b: Task): number {
  if (a.due !== b.due) {
    if (!a.due) return 1
    if (!b.due) return -1
    return a.due < b.due ? -1 : 1
  }
  // Same day: timed tasks first, in order, then the rest.
  if (a.time !== b.time) {
    if (!a.time) return 1
    if (!b.time) return -1
    return a.time < b.time ? -1 : 1
  }
  return a.createdAt - b.createdAt
}
