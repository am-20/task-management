import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from './store'

const state = () => useStore.getState()
const byTitle = (title: string) => state().tasks.filter((t) => t.title === title)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 18, 9, 0)) // Wednesday 18 Nov 2026, 9:00
  state().clearAll()
})

describe('repeating tasks', () => {
  it('finishing one keeps it as history and creates the next', () => {
    state().addTask({ title: 'Water plants', due: '2026-11-18', repeat: { every: 3, unit: 'day' } })
    const [first] = byTitle('Water plants')
    state().toggleTask(first.id)
    const all = byTitle('Water plants')
    expect(all).toHaveLength(2)
    const done = all.find((t) => t.done)!
    const next = all.find((t) => !t.done)!
    expect(done.id).toBe(first.id)
    expect(next.due).toBe('2026-11-21')
    expect(next.repeat?.occurrence).toBe(2)
    expect(next.seriesId).toBe(done.seriesId)
  })

  it('un-ticking by mistake takes the new occurrence back', () => {
    state().addTask({ title: 'Stretch', due: '2026-11-18', repeat: { every: 1, unit: 'day' } })
    const id = byTitle('Stretch')[0].id
    state().toggleTask(id)
    state().toggleTask(id)
    expect(byTitle('Stretch')).toHaveLength(1)
    expect(byTitle('Stretch')[0].done).toBe(false)
    // and finishing again works as before
    state().toggleTask(id)
    expect(byTitle('Stretch')).toHaveLength(2)
  })

  it('the series ends after the set number of times', () => {
    state().addTask({ title: 'Physio', due: '2026-11-18', repeat: { every: 1, unit: 'week', weekdays: [3], count: 2 } })
    state().toggleTask(byTitle('Physio')[0].id)
    const second = byTitle('Physio').find((t) => !t.done)!
    expect(second.due).toBe('2026-11-25')
    state().toggleTask(second.id)
    expect(byTitle('Physio').every((t) => t.done)).toBe(true)
    expect(byTitle('Physio')).toHaveLength(2)
  })

  it('setting a weekly repeat moves the date to the first matching day', () => {
    state().addTask({ title: 'Gym', due: '2026-11-18' })
    state().setRepeat(byTitle('Gym')[0].id, { every: 1, unit: 'week', weekdays: [1, 4] })
    expect(byTitle('Gym')[0].due).toBe('2026-11-19')
  })

  it('a repeat without a date starts today', () => {
    state().addTask({ title: 'Journal', repeat: { every: 1, unit: 'day' } })
    expect(byTitle('Journal')[0].due).toBe('2026-11-18')
  })

  it('skipping moves to the next date without recording it as done', () => {
    state().addTask({ title: 'Call mum', due: '2026-11-18', repeat: { every: 1, unit: 'week', weekdays: [3] } })
    state().skipOccurrence(byTitle('Call mum')[0].id)
    expect(byTitle('Call mum')).toHaveLength(1)
    expect(byTitle('Call mum')[0]).toMatchObject({ due: '2026-11-25', done: false })
  })

  it('stopping the repeat leaves a normal task', () => {
    state().addTask({ title: 'Bins', due: '2026-11-18', repeat: { every: 1, unit: 'week' } })
    const id = byTitle('Bins')[0].id
    state().setRepeat(id, undefined)
    state().toggleTask(id)
    expect(byTitle('Bins')).toHaveLength(1)
  })

  it('repeat settings survive a round trip through import (sync uses the same cleaning)', () => {
    state().addTask({ title: 'Rent', due: '2026-12-01', repeat: { every: 1, unit: 'month', monthBy: 'day', monthDay: 1 } })
    const snapshot = JSON.parse(JSON.stringify({ areas: [], pages: [], tasks: state().tasks, habits: [] }))
    state().importData(snapshot)
    expect(byTitle('Rent')[0].repeat).toMatchObject({ every: 1, unit: 'month', monthBy: 'day', monthDay: 1, occurrence: 1 })
  })
})

describe('forward compatibility', () => {
  it('keeps fields a future version adds', () => {
    useStore.getState().importData({
      areas: [{ id: 'a1', name: 'Home', icon: '🏡', color: '#c2622d', description: '', createdAt: 1, futureField: 'x' } as never],
      pages: [],
      tasks: [{ id: 't1', title: 'Bins', done: false, createdAt: 1, priority: 'high' } as never],
      habits: [{ id: 'h1', name: 'Walk', icon: '🥾', log: {}, createdAt: 1, reminder: '08:00' } as never],
    })
    const s = useStore.getState() as unknown as Record<string, Record<string, unknown>[]>
    expect(s.areas[0].futureField).toBe('x')
    expect(s.tasks[0].priority).toBe('high')
    expect(s.habits[0].reminder).toBe('08:00')
  })
})
