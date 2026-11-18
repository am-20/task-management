import { describe, expect, it } from 'vitest'
import { habitStreak, isScheduled, scheduleLabel } from './habits'
import type { Habit } from '../types'

// 18 Nov 2026 is a Wednesday.
const habit = (log: string[], days?: number[]): Habit => ({
  id: 'h',
  name: 'Gym',
  icon: '🏃',
  log: Object.fromEntries(log.map((d) => [d, true])),
  days,
  createdAt: new Date(2026, 9, 1).getTime(),
})

describe('habit schedules', () => {
  it('no schedule means every day', () => {
    expect(isScheduled(habit([]), '2026-11-21')).toBe(true)
    expect(scheduleLabel(habit([]))).toBe('Every day')
  })
  it('knows rest days', () => {
    const gym = habit([], [1, 3, 5])
    expect(isScheduled(gym, '2026-11-18')).toBe(true) // Wed
    expect(isScheduled(gym, '2026-11-19')).toBe(false) // Thu
    expect(scheduleLabel(gym)).toBe('Mon, Wed, Fri')
    expect(scheduleLabel(habit([], [5, 4, 3, 2, 1]))).toBe('Weekdays')
  })
})

describe('streaks', () => {
  it('daily habit: consecutive days', () =>
    expect(habitStreak(habit(['2026-11-16', '2026-11-17', '2026-11-18']), '2026-11-18')).toBe(3))
  it('today still open does not break the run', () =>
    expect(habitStreak(habit(['2026-11-16', '2026-11-17']), '2026-11-18')).toBe(2))
  it('a missed day breaks it', () => expect(habitStreak(habit(['2026-11-15', '2026-11-17']), '2026-11-18')).toBe(1))
  it('rest days are skipped, not counted as misses', () =>
    // Mon/Wed/Fri: done Fri 13, Mon 16, Wed 18 → 3, with Sat/Sun/Tue off
    expect(habitStreak(habit(['2026-11-13', '2026-11-16', '2026-11-18'], [1, 3, 5]), '2026-11-18')).toBe(3))
  it('a missed scheduled day still breaks it', () =>
    expect(habitStreak(habit(['2026-11-11', '2026-11-16', '2026-11-18'], [1, 3, 5]), '2026-11-18')).toBe(2))
  it('on a rest day the run carries on from the last scheduled day', () =>
    expect(habitStreak(habit(['2026-11-16', '2026-11-18'], [1, 3, 5]), '2026-11-19')).toBe(2))
})
