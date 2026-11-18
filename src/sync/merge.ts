import type { DataSnapshot } from '../types'

/** Deep equality that ignores key order and treats missing and undefined keys alike. */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return (a ?? undefined) === (b ?? undefined)
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    const bb = b as unknown[]
    return a.length === bb.length && a.every((v, i) => same(v, bb[i]))
  }
  const ao = a as Record<string, unknown>
  const bo = b as Record<string, unknown>
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)])
  for (const k of keys) if (!same(ao[k], bo[k])) return false
  return true
}

interface WithId {
  id: string
}

/**
 * Three-way merge of a list of records by id.
 * Local edits win over remote edits of the same record; everything else is combined,
 * so adding a task on the phone and a page on the laptop keeps both.
 */
export function mergeList<T extends WithId>(base: T[], local: T[], remote: T[]): T[] {
  const B = new Map(base.map((x) => [x.id, x]))
  const L = new Map(local.map((x) => [x.id, x]))
  const R = new Map(remote.map((x) => [x.id, x]))
  const out: T[] = []

  for (const r of remote) {
    const b = B.get(r.id)
    const l = L.get(r.id)
    if (!l) {
      // Deleted here. Keep it only if it was changed (or created) on the other device.
      if (b && same(b, r)) continue
      out.push(r)
      continue
    }
    const changedHere = !b || !same(b, l)
    out.push(changedHere ? l : r)
  }

  for (const l of local) {
    if (R.has(l.id)) continue
    const b = B.get(l.id)
    // Deleted on the other device and untouched here: let the deletion stand.
    if (b && same(b, l)) continue
    out.push(l)
  }
  return out
}

export function mergeSnapshots(base: DataSnapshot, local: DataSnapshot, remote: DataSnapshot): DataSnapshot {
  return {
    areas: mergeList(base.areas, local.areas, remote.areas),
    pages: mergeList(base.pages, local.pages, remote.pages),
    tasks: mergeList(base.tasks, local.tasks, remote.tasks),
    habits: mergeList(base.habits, local.habits, remote.habits),
  }
}
