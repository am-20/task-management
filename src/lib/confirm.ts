/** A tiny promise-based confirm dialog; rendered by <ConfirmHost />. */

export interface ConfirmOptions {
  title: string
  body?: string
  action?: string
  danger?: boolean
}

export interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

let current: ConfirmState | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    current?.resolve(false)
    current = { ...options, resolve }
    emit()
  })
}

export function subscribeConfirm(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export const getConfirm = () => current

export function settleConfirm(ok: boolean) {
  current?.resolve(ok)
  current = null
  emit()
}
