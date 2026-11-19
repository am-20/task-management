/** A single short message at the bottom of the screen, optionally with an action (Undo). */

export interface Toast {
  id: number
  message: string
  action?: { label: string; run: () => void }
}

let current: Toast | null = null
let timer: number | undefined
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function showToast(message: string, action?: Toast['action'], ms = 5000) {
  window.clearTimeout(timer)
  current = { id: nextId++, message, action }
  emit()
  timer = window.setTimeout(dismissToast, ms)
}

export function dismissToast() {
  window.clearTimeout(timer)
  current = null
  emit()
}

export function subscribeToast(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export const getToast = () => current
