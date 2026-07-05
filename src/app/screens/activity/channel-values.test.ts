import { describe, expect, it } from 'vitest'
import { syntheticActivity, syntheticSeries } from '../../../domain/testing/synthetic'
import { channelValuesAt } from './channel-values'

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
