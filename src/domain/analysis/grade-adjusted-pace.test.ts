import { describe, expect, it } from 'vitest'
import { makeSeries } from '../model/series'
import { syntheticActivity } from '../testing/synthetic'
import { gradeAdjustedSpeed, runningCost } from './grade-adjusted-pace'

describe('runningCost', () => {
  it('flat cost is 3.6 J/kg/m', () => {
    expect(runningCost(0)).toBeCloseTo(3.6, 6)
  })
  it('uphill costs more than flat, downhill (shallow) costs less', () => {
    expect(runningCost(0.1)).toBeGreaterThan(runningCost(0))
    expect(runningCost(-0.1)).toBeLessThan(runningCost(0))
  })
})

describe('gradeAdjustedSpeed', () => {
  it('returns null without distance or altitude', () => {
    const a = syntheticActivity({ durationS: 100 })
    expect(gradeAdjustedSpeed(a, { startS: 0, endS: 100 })).toBeNull()
  })

  it('equals real average speed on flat ground', () => {
    // 3 m/s for 300 s → distance 0..900, altitude constant.
    const t = Array.from({ length: 301 }, (_, i) => i)
    const a = syntheticActivity({
      durationS: 301,
      channels: {
        distance: makeSeries(t, t.map((s) => s * 3)),
        altitude: makeSeries(t, t.map(() => 100)),
      },
    })
    const gap = gradeAdjustedSpeed(a, { startS: 0, endS: 300 })!
    expect(gap).toBeCloseTo(3, 2)
  })

  it('raises the equivalent-flat speed on a sustained climb', () => {
    // 3 m/s horizontal, +0.1 grade (rise 0.3 m/s): uphill → GAP speed > real speed.
    const t = Array.from({ length: 301 }, (_, i) => i)
    const a = syntheticActivity({
      durationS: 301,
      channels: {
        distance: makeSeries(t, t.map((s) => s * 3)),
        altitude: makeSeries(t, t.map((s) => 100 + s * 0.3)),
      },
    })
    const gap = gradeAdjustedSpeed(a, { startS: 0, endS: 300 })!
    expect(gap).toBeGreaterThan(3)
    // factor = Cr(0.1)/Cr(0); equiv-flat speed ≈ 3 * that factor
    expect(gap).toBeCloseTo(3 * (runningCost(0.1) / runningCost(0)), 1)
  })
})
