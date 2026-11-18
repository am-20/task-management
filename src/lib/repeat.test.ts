import { describe, expect, it } from 'vitest'
import { addMonths, cleanRepeat, describeRepeat, firstOnOrAfter, nextDue, presets, upcomingDates } from './repeat'
import type { Repeat } from '../types'

// 18 Nov 2026 is a Wednesday.
const WED = '2026-11-18'

describe('daily', () => {
  it('moves to tomorrow', () => expect(nextDue({ every: 1, unit: 'day' }, WED, WED)).toBe('2026-11-19'))
  it('every 3 days keeps its rhythm', () => expect(nextDue({ every: 3, unit: 'day' }, WED, WED)).toBe('2026-11-21'))
  it('a late task moves to the next date after today, on its rhythm', () =>
    // 10th, 13th, 16th, 19th …
    expect(nextDue({ every: 3, unit: 'day' }, '2026-11-10', WED)).toBe('2026-11-19'))
  it('finished early: counts from the due date', () =>
    expect(nextDue({ every: 1, unit: 'day' }, '2026-11-25', WED)).toBe('2026-11-26'))
})

describe('weekly', () => {
  it('weekdays skip the weekend', () =>
    expect(nextDue({ every: 1, unit: 'week', weekdays: [1, 2, 3, 4, 5] }, '2026-11-20', '2026-11-20')).toBe('2026-11-23'))
  it('several days a week', () => {
    const rule: Repeat = { every: 1, unit: 'week', weekdays: [1, 4] }
    expect(nextDue(rule, '2026-11-16', '2026-11-16')).toBe('2026-11-19')
    expect(nextDue(rule, '2026-11-19', '2026-11-19')).toBe('2026-11-23')
  })
  it('every 2 weeks', () =>
    expect(nextDue({ every: 2, unit: 'week', weekdays: [3] }, WED, WED)).toBe('2026-12-02'))
  it('every 2 weeks on two days', () => {
    const rule: Repeat = { every: 2, unit: 'week', weekdays: [1, 4] }
    expect(nextDue(rule, '2026-11-16', '2026-11-16')).toBe('2026-11-19')
    expect(nextDue(rule, '2026-11-19', '2026-11-19')).toBe('2026-11-30')
  })
  it('weekly with no days set uses the due date’s weekday', () =>
    expect(nextDue({ every: 1, unit: 'week' }, WED, WED)).toBe('2026-11-25'))
  it('crosses the new year', () =>
    expect(nextDue({ every: 1, unit: 'week', weekdays: [5] }, '2026-12-25', '2026-12-25')).toBe('2027-01-01'))
})

describe('monthly', () => {
  it('on a date', () =>
    expect(nextDue({ every: 1, unit: 'month', monthBy: 'day', monthDay: 18 }, WED, WED)).toBe('2026-12-18'))
  it('the 31st falls back to the last day in short months, then returns to the 31st', () => {
    const rule: Repeat = { every: 1, unit: 'month', monthBy: 'day', monthDay: 31 }
    expect(nextDue(rule, '2026-01-31', '2026-01-31')).toBe('2026-02-28')
    expect(nextDue(rule, '2026-02-28', '2026-02-28')).toBe('2026-03-31')
  })
  it('on the last day', () =>
    expect(nextDue({ every: 1, unit: 'month', monthBy: 'day', monthDay: -1 }, '2026-02-28', '2026-02-28')).toBe('2026-03-31'))
  it('on the third Wednesday', () =>
    expect(nextDue({ every: 1, unit: 'month', monthBy: 'weekday', nth: 3, weekday: 3 }, WED, WED)).toBe('2026-12-16'))
  it('on the last Friday', () =>
    expect(nextDue({ every: 1, unit: 'month', monthBy: 'weekday', nth: -1, weekday: 5 }, '2026-11-27', '2026-11-27')).toBe('2026-12-25'))
  it('every 3 months', () =>
    expect(nextDue({ every: 3, unit: 'month', monthBy: 'day', monthDay: 18 }, WED, WED)).toBe('2027-02-18'))
  it('a late monthly task skips to the next month after today', () =>
    expect(nextDue({ every: 1, unit: 'month', monthBy: 'day', monthDay: 5 }, '2026-09-05', WED)).toBe('2026-12-05'))
})

describe('yearly', () => {
  it('same date next year', () => expect(nextDue({ every: 1, unit: 'year' }, WED, WED)).toBe('2027-11-18'))
  it('29 February falls back to the 28th', () =>
    expect(nextDue({ every: 1, unit: 'year' }, '2028-02-29', '2028-02-29')).toBe('2029-02-28'))
})

describe('after completion', () => {
  it('counts from the day it was done', () =>
    expect(nextDue({ every: 3, unit: 'month', fromCompletion: true }, '2026-10-01', WED)).toBe('2027-02-18'))
  it('every 10 days after done', () =>
    expect(nextDue({ every: 10, unit: 'day', fromCompletion: true }, '2026-11-01', WED)).toBe('2026-11-28'))
})

describe('ending', () => {
  it('stops after the end date', () =>
    expect(nextDue({ every: 1, unit: 'day', until: '2026-11-20' }, '2026-11-20', '2026-11-20')).toBeNull())
  it('the last day before the end date is still allowed', () =>
    expect(nextDue({ every: 1, unit: 'day', until: '2026-11-20' }, '2026-11-19', '2026-11-19')).toBe('2026-11-20'))
  it('stops after N times', () => {
    expect(nextDue({ every: 1, unit: 'day', count: 3, occurrence: 2 }, WED, WED)).toBe('2026-11-19')
    expect(nextDue({ every: 1, unit: 'day', count: 3, occurrence: 3 }, WED, WED)).toBeNull()
  })
})

describe('calendar preview', () => {
  it('lists future dates in range', () =>
    expect(upcomingDates({ every: 1, unit: 'week', weekdays: [1] }, '2026-11-16', '2026-11-01', '2026-11-30')).toEqual([
      '2026-11-23',
      '2026-11-30',
    ]))
  it('respects the count', () =>
    expect(upcomingDates({ every: 1, unit: 'day', count: 3, occurrence: 1 }, WED, WED, '2026-12-31')).toEqual([
      '2026-11-19',
      '2026-11-20',
    ]))
  it('cannot predict "after done" tasks', () =>
    expect(upcomingDates({ every: 1, unit: 'day', fromCompletion: true }, WED, WED, '2026-12-31')).toEqual([]))
})

describe('first date when a repeat is set', () => {
  it('moves to the first matching weekday', () =>
    expect(firstOnOrAfter({ every: 1, unit: 'week', weekdays: [1] }, WED)).toBe('2026-11-23'))
  it('keeps a date that already matches', () =>
    expect(firstOnOrAfter({ every: 1, unit: 'week', weekdays: [3] }, WED)).toBe(WED))
  it('monthly date later this month', () =>
    expect(firstOnOrAfter({ every: 1, unit: 'month', monthBy: 'day', monthDay: 25 }, WED)).toBe('2026-11-25'))
  it('monthly date already passed this month', () =>
    expect(firstOnOrAfter({ every: 1, unit: 'month', monthBy: 'day', monthDay: 1 }, WED)).toBe('2026-12-01'))
})

describe('words', () => {
  it.each<[Repeat, string]>([
    [{ every: 1, unit: 'day' }, 'Daily'],
    [{ every: 3, unit: 'day' }, 'Every 3 days'],
    [{ every: 1, unit: 'week', weekdays: [1, 2, 3, 4, 5] }, 'Weekdays'],
    [{ every: 1, unit: 'week', weekdays: [0, 6] }, 'Weekends'],
    [{ every: 1, unit: 'week', weekdays: [4, 1] }, 'Every Mon, Thu'],
    [{ every: 2, unit: 'week', weekdays: [3] }, 'Every 2 weeks on Wednesday'],
    [{ every: 1, unit: 'month', monthBy: 'day', monthDay: 2 }, 'Monthly on the 2nd'],
    [{ every: 1, unit: 'month', monthBy: 'day', monthDay: -1 }, 'Monthly on the last day'],
    [{ every: 1, unit: 'month', monthBy: 'weekday', nth: 2, weekday: 2 }, 'Monthly on the second Tuesday'],
    [{ every: 6, unit: 'month', monthBy: 'day', monthDay: 11 }, 'Every 6 months on the 11th'],
    [{ every: 1, unit: 'year' }, 'Yearly'],
    [{ every: 3, unit: 'month', fromCompletion: true }, 'Every 3 months after done'],
    [{ every: 1, unit: 'day', count: 10 }, 'Daily, 10 times'],
  ])('%j → %s', (rule, text) => expect(describeRepeat(rule)).toBe(text))

  it('offers choices that fit the date', () => {
    const labels = presets(WED).map((p) => p.label)
    expect(labels).toContain('Every month on the third Wednesday')
    expect(labels).not.toContain('Every month on the last day')
    expect(presets('2026-11-30').map((p) => p.label)).toContain('Every month on the last day')
    expect(presets('2026-11-27').map((p) => p.label)).toContain('Every month on the last Friday')
  })
})

describe('cleaning stored data', () => {
  it('drops nonsense', () => {
    expect(cleanRepeat(null)).toBeUndefined()
    expect(cleanRepeat({ unit: 'fortnight' })).toBeUndefined()
    expect(cleanRepeat({ unit: 'week', every: -4, weekdays: [1, 1, 9, 'x'] })).toEqual({ every: 1, unit: 'week', weekdays: [1] })
    expect(cleanRepeat({ unit: 'month', every: 2, monthBy: 'weekday', nth: 7, weekday: 3 })).toEqual({
      every: 2,
      unit: 'month',
      monthBy: 'weekday',
      nth: 1,
      weekday: 3,
    })
  })
})

describe('month arithmetic', () => {
  it('clamps to the end of shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2026-12-15', 2)).toBe('2027-02-15')
  })
})
