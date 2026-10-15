import { describe, expect, it } from 'vitest'
import { describeRhythm, todayYmd, toggleWeekday } from './routes-logic'

describe('a visit plan in words', () => {
  it('names the days in week order and the rhythm', () => {
    expect(describeRhythm([4, 1], 1)).toBe('Mon, Thu · every week')
    expect(describeRhythm([3], 2)).toBe('Wed · every 2 weeks')
    expect(describeRhythm([], 1)).toBe('—')
  })
})

describe('picking the weekdays', () => {
  it('ticks a day on and off and keeps the week in order', () => {
    expect(toggleWeekday([5], 1)).toEqual([1, 5])
    expect(toggleWeekday([1, 5], 5)).toEqual([1])
  })

  it('reads today in local time', () => {
    expect(todayYmd(new Date(2026, 9, 5, 23, 30))).toBe('2026-10-05')
  })
})
