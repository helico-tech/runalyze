import { describe, expect, it } from 'vitest'
import {
  defaultExclusions,
  makeSeries,
  nonExcludedRange,
  overlapsExclusion,
  rangeLengthS,
} from './series'
import { syntheticActivity } from '../testing/synthetic'

describe('makeSeries', () => {
  it('builds Float64Array series from number arrays', () => {
    const s = makeSeries([0, 1, 2], [10, 11, 12])
    expect(s.t).toBeInstanceOf(Float64Array)
    expect(s.v).toBeInstanceOf(Float64Array)
    expect(Array.from(s.t)).toEqual([0, 1, 2])
    expect(Array.from(s.v)).toEqual([10, 11, 12])
  })

  it('allows an empty series', () => {
    const s = makeSeries([], [])
    expect(s.t.length).toBe(0)
  })

  it('throws on length mismatch', () => {
    expect(() => makeSeries([0, 1], [10])).toThrow(/equal length/)
  })

  it('throws on non-increasing timestamps', () => {
    expect(() => makeSeries([0, 2, 2], [1, 2, 3])).toThrow(/strictly increasing/)
    expect(() => makeSeries([0, 2, 1], [1, 2, 3])).toThrow(/strictly increasing/)
  })
})

describe('range helpers', () => {
  it('rangeLengthS', () => {
    expect(rangeLengthS({ startS: 100, endS: 700 })).toBe(600)
  })

  it('defaultExclusions excludes nothing', () => {
    expect(defaultExclusions(3600)).toEqual({ warmupEndS: 0, cooldownStartS: 3600 })
  })

  it('nonExcludedRange reflects trims', () => {
    const a = syntheticActivity({
      durationS: 5400,
      exclusions: { warmupEndS: 600, cooldownStartS: 5100 },
    })
    expect(nonExcludedRange(a)).toEqual({ startS: 600, endS: 5100 })
  })

  it('overlapsExclusion detects warmup and cooldown overlap', () => {
    const a = syntheticActivity({
      durationS: 5400,
      exclusions: { warmupEndS: 600, cooldownStartS: 5100 },
    })
    expect(overlapsExclusion(a, { startS: 300, endS: 3900 })).toBe(true)
    expect(overlapsExclusion(a, { startS: 900, endS: 5200 })).toBe(true)
    expect(overlapsExclusion(a, { startS: 600, endS: 5100 })).toBe(false)
    expect(overlapsExclusion(a, { startS: 900, endS: 4500 })).toBe(false)
  })
})
