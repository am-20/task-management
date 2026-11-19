import { describe, expect, it } from 'vitest'
import { mergeSnapshots } from './merge'
import type { DataSnapshot, Task } from '../types'

const snap = (tasks: Task[]): DataSnapshot => ({ areas: [], pages: [], tasks, habits: [] })
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, done: false, createdAt: 1, ...extra })

describe('merging two devices', () => {
  it('keeps additions from both sides', () => {
    const base = snap([task('a')])
    const merged = mergeSnapshots(base, snap([task('a'), task('phone')]), snap([task('a'), task('laptop')]))
    expect(merged.tasks.map((t) => t.id).sort()).toEqual(['a', 'laptop', 'phone'])
  })

  it('a deletion on one side wins over an untouched copy on the other', () => {
    const base = snap([task('a'), task('b')])
    const merged = mergeSnapshots(base, snap([task('a')]), snap([task('a'), task('b')]))
    expect(merged.tasks.map((t) => t.id)).toEqual(['a'])
  })

  it('the same repeating task finished on both devices leaves one next occurrence', () => {
    const repeat = { every: 1, unit: 'day' as const }
    const open = task('r1', { repeat, seriesId: 'r1', due: '2026-11-18' })
    const base = snap([open])
    const local = snap([
      { ...open, done: true, doneAt: 5, spawnedId: 'phone-next' },
      task('phone-next', { repeat, seriesId: 'r1', due: '2026-11-19' }),
    ])
    const remote = snap([
      { ...open, done: true, doneAt: 6, spawnedId: 'laptop-next' },
      task('laptop-next', { repeat, seriesId: 'r1', due: '2026-11-19' }),
    ])
    const merged = mergeSnapshots(base, local, remote)
    const next = merged.tasks.filter((t) => !t.done)
    expect(next).toHaveLength(1)
    // The finished task points at the copy that was kept.
    expect(merged.tasks.find((t) => t.id === 'r1')!.spawnedId).toBe(next[0].id)
  })
})
