import { describe, expect, it } from 'vitest'
import { makeSeries } from '../model/series'
import { syntheticSeries } from '../testing/synthetic'
import { efficiencySeries, rollingMean } from './efficiency'

describe('efficiencySeries', () => {
  it('computes scaled output/HR at HR timestamps', () => {
    const speed = syntheticSeries({ durationS: 4, value: () => 3 }) // 3 m/s
    const hr = syntheticSeries({ durationS: 4, value: () => 150 })
    const ef = efficiencySeries(speed, hr, 60) // m/min per bpm
    expect(ef.t.length).toBe(4)
    expect(ef.v[0]).toBeCloseTo((60 * 3) / 150, 9) // 1.2
  })

  it('aligns output to the nearest HR timestamp', () => {
    const output = makeSeries([0, 10], [2, 4])
    const hr = makeSeries([0, 4, 9], [100, 100, 100])
    const ef = efficiencySeries(output, hr, 1)
    // hr@0 → output idx0 (2), hr@4 → nearest output idx0 (2), hr@9 → output idx1 (4)
    expect(Array.from(ef.v)).toEqual([2 / 100, 2 / 100, 4 / 100])
  })

  it('skips samples with non-positive or non-finite HR', () => {
    const output = syntheticSeries({ durationS: 3, value: () => 3 })
    const hr = makeSeries([0, 1, 2], [150, 0, NaN])
    const ef = efficiencySeries(output, hr, 1)
    expect(ef.t.length).toBe(1)
    expect(ef.t[0]).toBe(0)
  })
})

describe('rollingMean', () => {
  it('smooths within the time window', () => {
    const s = makeSeries([0, 1, 2, 3, 4], [0, 10, 0, 10, 0])
    const m = rollingMean(s, 2) // ±1s window
    expect(m.v[0]).toBeCloseTo(5, 6) // mean(0,10)
    expect(m.v[1]).toBeCloseTo(10 / 3, 6) // mean(0,10,0)
    expect(m.v[2]).toBeCloseTo(20 / 3, 6) // mean(10,0,10)
  })

  it('returns empty for empty input', () => {
    expect(rollingMean(makeSeries([], []), 2).t.length).toBe(0)
  })
})
