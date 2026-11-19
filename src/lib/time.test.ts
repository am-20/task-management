import { describe, expect, it } from 'vitest'
import { formatDuration, fromMinutes, hourRange, toMinutes } from './time'

describe('week grid hours', () => {
  it('shows 5:00–23:00 by default', () => expect(hourRange([])).toEqual({ start: 300, end: 1380 }))
  it('ignores tasks inside those hours', () =>
    expect(hourRange([{ time: '09:00', duration: 60 }, { time: '22:00', duration: 60 }])).toEqual({ start: 300, end: 1380 }))
  it('starts earlier for an early task, on the hour', () =>
    expect(hourRange([{ time: '03:30', duration: 30 }])).toEqual({ start: 180, end: 1380 }))
  it('ends later for a late task, on the hour', () =>
    expect(hourRange([{ time: '22:30', duration: 60 }])).toEqual({ start: 300, end: 1440 }))
  it('never goes past midnight', () => expect(hourRange([{ time: '23:30', duration: 120 }]).end).toBe(1440))
})

describe('time helpers', () => {
  it('round-trips minutes', () => {
    expect(toMinutes('14:45')).toBe(885)
    expect(fromMinutes(885)).toBe('14:45')
    expect(fromMinutes(-5)).toBe('00:00')
  })
  it('describes lengths', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(90)).toBe('1 h 30 min')
  })
})
