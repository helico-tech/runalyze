import { describe, expect, it } from 'vitest'
import { makeSeries } from '../model/series'
import { syntheticSeries } from '../testing/synthetic'
import { splitHalves, uncoveredS, windowStats, windowStdDev } from './stats'

describe('splitHalves', () => {
  it('splits at the temporal midpoint', () => {
    expect(splitHalves({ startS: 100, endS: 700 })).toEqual({
      first: { startS: 100, endS: 400 },
      second: { startS: 400, endS: 700 },
    })
  })
})

describe('windowStats', () => {
  it('computes exact stats over a uniform 1Hz constant series', () => {
    const s = syntheticSeries({ durationS: 600, value: () => 10 })
    const st = windowStats(s, { startS: 0, endS: 600 })
    expect(st.mean).toBe(10)
    expect(st.min).toBe(10)
    expect(st.max).toBe(10)
    expect(st.weightS).toBe(600)
    expect(st.gapS).toBe(0)
    expect(st.sampleCount).toBe(600)
  })

  it('weights a two-level series correctly', () => {
    const s = syntheticSeries({ durationS: 200, value: (t) => (t < 100 ? 10 : 20) })
    expect(windowStats(s, { startS: 0, endS: 200 }).mean).toBe(15)
  })

  it('clips to the requested range (half-open)', () => {
    const s = syntheticSeries({ durationS: 200, value: (t) => (t < 100 ? 10 : 20) })
    expect(windowStats(s, { startS: 50, endS: 150 }).mean).toBe(15)
    expect(windowStats(s, { startS: 0, endS: 100 }).mean).toBe(10)
  })

  it('treats long sample deltas as gaps with no weight', () => {
    // 1Hz t=0..99 @10, then t=300..399 @20; delta at t=99 is 201s -> gap
    const t = [...Array(100).keys(), ...Array.from(Array(100).keys(), (i) => i + 300)]
    const v = [...Array(100).fill(10), ...Array(100).fill(20)]
    const st = windowStats(makeSeries(t, v), { startS: 0, endS: 400 })
    expect(st.weightS).toBe(199)
    expect(st.gapS).toBe(201)
    expect(st.mean).toBeCloseTo(2990 / 199, 6)
    expect(st.sampleCount).toBe(200)
    expect(st.min).toBe(10)
    expect(st.max).toBe(20)
  })

  it('skips non-finite samples entirely', () => {
    const t = [...Array(10).keys()]
    const v = Array(10).fill(5)
    v[5] = NaN
    const st = windowStats(makeSeries(t, v), { startS: 0, endS: 10 })
    expect(st.mean).toBe(5)
    expect(st.weightS).toBe(9)
    expect(st.sampleCount).toBe(9)
  })

  it('returns NaN mean and zero weight for an empty range', () => {
    const s = syntheticSeries({ durationS: 10, value: () => 1 })
    const st = windowStats(s, { startS: 100, endS: 200 })
    expect(st.mean).toBeNaN()
    expect(st.min).toBeNaN()
    expect(st.max).toBeNaN()
    expect(st.weightS).toBe(0)
    expect(st.sampleCount).toBe(0)
  })
})

describe('windowStdDev', () => {
  it('is zero for a constant series', () => {
    const s = syntheticSeries({ durationS: 100, value: () => 42 })
    expect(windowStdDev(s, { startS: 0, endS: 100 })).toBe(0)
  })

  it('computes population stddev', () => {
    expect(windowStdDev(makeSeries([0, 1], [10, 20]), { startS: 0, endS: 2 })).toBe(5)
  })

  it('is NaN with no samples', () => {
    const s = syntheticSeries({ durationS: 10, value: () => 1 })
    expect(windowStdDev(s, { startS: 50, endS: 60 })).toBeNaN()
  })
})

describe('uncoveredS', () => {
  it('is zero for full coverage', () => {
    const s = syntheticSeries({ durationS: 600, value: () => 1 })
    expect(uncoveredS(s, { startS: 0, endS: 600 })).toBe(0)
  })

  it('counts attributed gaps and missing leading spans', () => {
    const t = [...Array(100).keys(), ...Array.from(Array(100).keys(), (i) => i + 300)]
    const v = Array(200).fill(1)
    const s = makeSeries(t, v)
    // attributed gap: sample t=99 has delta 201
    expect(uncoveredS(s, { startS: 0, endS: 400 })).toBe(201)
    // leading void: no samples in [150, 300)
    expect(uncoveredS(s, { startS: 150, endS: 400 })).toBe(150)
  })
})
