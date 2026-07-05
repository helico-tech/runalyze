import { describe, expect, it } from 'vitest'
import { syntheticActivity, syntheticSeries } from '../testing/synthetic'
import { sectorStats } from './sector-stats'

describe('sectorStats', () => {
  it('computes whole and half stats per present channel', () => {
    const a = syntheticActivity({
      durationS: 1200,
      channels: {
        heartRate: syntheticSeries({ durationS: 1200, value: () => 150 }),
        speed: syntheticSeries({ durationS: 1200, value: (t) => (t < 600 ? 3 : 4) }),
      },
    })
    const stats = sectorStats(a, { startS: 0, endS: 1200 })
    expect(stats.speed?.whole.mean).toBe(3.5)
    expect(stats.speed?.firstHalf.mean).toBe(3)
    expect(stats.speed?.secondHalf.mean).toBe(4)
    expect(stats.heartRate?.whole.mean).toBe(150)
    expect(stats.power).toBeUndefined()
  })
})
