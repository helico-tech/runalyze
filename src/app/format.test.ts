import { describe, expect, it } from 'vitest'
import { formatBpm, formatDate, formatDistanceKm, formatDuration, formatPace } from './format'

describe('format', () => {
  it('formats durations', () => {
    expect(formatDuration(45)).toBe('0:45')
    expect(formatDuration(754)).toBe('12:34')
    expect(formatDuration(3600.873)).toBe('1:00:01')
    expect(formatDuration(10644.774)).toBe('2:57:25')
  })

  it('formats pace from speed', () => {
    expect(formatPace(2.5059)).toBe('6:39 /km') // 399.06 s/km
    expect(formatPace(3)).toBe('5:33 /km') // 333.33 s/km
    expect(formatPace(0)).toBe('–')
    expect(formatPace(NaN)).toBe('–')
  })

  it('formats distance and bpm', () => {
    expect(formatDistanceKm(9035.12)).toBe('9.04 km')
    expect(formatDistanceKm(30016.3)).toBe('30.02 km')
    expect(formatDistanceKm(null)).toBe('–')
    expect(formatBpm(159.0103)).toBe('159 bpm')
    expect(formatBpm(null)).toBe('–')
  })

  it('formats dates from local date parts (tests pin TZ=UTC)', () => {
    expect(formatDate(new Date('2026-07-05T06:45:13.000Z'))).toBe('2026-07-05')
    expect(formatDate(new Date('2021-07-20T21:11:20.000Z'))).toBe('2021-07-20')
  })
})
