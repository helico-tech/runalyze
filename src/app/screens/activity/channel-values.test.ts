import { describe, expect, it } from 'vitest'
import { makeSeries } from '../../../domain/model/series'
import { syntheticActivity, syntheticSeries } from '../../../domain/testing/synthetic'
import { channelValuesAt, nearestIndex } from './channel-values'

describe('nearestIndex', () => {
  const t = makeSeries([0, 10, 20, 30], [0, 0, 0, 0]).t
  it('finds the closest index', () => {
    expect(nearestIndex(t, 0)).toBe(0)
    expect(nearestIndex(t, 12)).toBe(1)
    expect(nearestIndex(t, 16)).toBe(2)
    expect(nearestIndex(t, 100)).toBe(3)
    expect(nearestIndex(t, -5)).toBe(0)
  })
  it('handles an empty array', () => {
    expect(nearestIndex(makeSeries([], []).t, 5)).toBe(-1)
  })
})

describe('channelValuesAt', () => {
  it('reads the nearest value per present channel', () => {
    const a = syntheticActivity({
      durationS: 100,
      channels: {
        heartRate: syntheticSeries({ durationS: 100, value: (t) => 150 + t / 10 }),
        speed: syntheticSeries({ durationS: 100, value: () => 3 }),
      },
    })
    const vals = channelValuesAt(a, 50)
    const hr = vals.find((v) => v.key === 'heartRate')!
    expect(hr.text).toBe('155') // 150 + 50/10
    expect(vals.find((v) => v.key === 'pace')!.text).toBe('5:33')
    expect(vals.some((v) => v.key === 'power')).toBe(false)
  })
})
