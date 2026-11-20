import type { Task } from '../types'

/** Progress through a task's steps, and the step to do next. */
export function stepInfo(task: Task) {
  const steps = task.steps ?? []
  const done = steps.filter((s) => s.done).length
  const nextIndex = steps.findIndex((s) => !s.done)
  return {
    total: steps.length,
    done,
    next: nextIndex >= 0 ? steps[nextIndex] : undefined,
    nextNumber: nextIndex + 1,
    allDone: steps.length > 0 && done === steps.length,
  }
}
