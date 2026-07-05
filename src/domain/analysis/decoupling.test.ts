import { describe, expect, it } from 'vitest'
import { syntheticSeries } from '../testing/synthetic'
import { computeDecoupling } from './decoupling'

const WINDOW = { startS: 0, endS: 3600 }
const constantPace = () => syntheticSeries({ durationS: 3600, value: () => 3 })

describe('computeDecoupling', () => {
  it('is exactly 5.0 when the second-half ratio drops 5%', () => {
    // HR2 = HR1 / 0.95 makes ratio2 = 0.95 * ratio1
    const hr = syntheticSeries({ durationS: 3600, value: (t) => (t < 1800 ? 150 : 150 / 0.95) })
    const d = computeDecoupling(constantPace(), hr, WINDOW)
    expect(d.decouplingPct).toBeCloseTo(5.0, 6)
    expect(d.firstHalf.hrMean).toBeCloseTo(150, 6)
    expect(d.firstHalf.ratio).toBeCloseTo(3 / 150, 9)
  })

  it('is ~4.76 (not 5.0) when HR rises exactly 5%', () => {
    const hr = syntheticSeries({ durationS: 3600, value: (t) => (t < 1800 ? 150 : 157.5) })
    const d = computeDecoupling(constantPace(), hr, WINDOW)
    expect(d.decouplingPct).toBeCloseTo((1 - 1 / 1.05) * 100, 6) // 4.7619...
  })

  it('is negative when HR falls in the second half', () => {
    const hr = syntheticSeries({ durationS: 3600, value: (t) => (t < 1800 ? 150 : 142.5) })
    const d = computeDecoupling(constantPace(), hr, WINDOW)
    expect(d.decouplingPct).toBeCloseTo((1 - 1 / 0.95) * 100, 6) // -5.263...
  })

  it('is positive when pace fades at constant HR', () => {
    const pace = syntheticSeries({ durationS: 3600, value: (t) => (t < 1800 ? 3 : 2.85) })
    const hr = syntheticSeries({ durationS: 3600, value: () => 150 })
    const d = computeDecoupling(pace, hr, WINDOW)
    expect(d.decouplingPct).toBeCloseTo(5.0, 6)
  })

  it('reports the worst uncovered span across both series', () => {
    const pace = constantPace()
    // HR missing for [1000, 1200): 200s uncovered
    const hr = syntheticSeries({
      durationS: 3600,
      value: (t) => 150 + (t >= 1000 && t < 1200 ? NaN : 0),
    })
    const d = computeDecoupling(pace, hr, WINDOW)
    expect(d.uncoveredS).toBe(200)
  })

  it('throws when a half has no usable data', () => {
    const pace = constantPace()
    const hr = syntheticSeries({ durationS: 1700, value: () => 150 }) // nothing in second half
    expect(() => computeDecoupling(pace, hr, WINDOW)).toThrow(/no usable data/)
  })
})
