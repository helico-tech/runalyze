import { describe, expect, it } from 'vitest'
import { makeSeries } from '../model/series'
import { syntheticActivity, syntheticSeries } from '../testing/synthetic'
import { activitySummary, rangeSummary } from './activity-summary'

describe('rangeSummary', () => {
  it('summarizes an arbitrary range', () => {
    const a = syntheticActivity({
      durationS: 600,
      channels: {
        heartRate: syntheticSeries({ durationS: 600, value: (t) => (t < 300 ? 140 : 160) }),
        distance: syntheticSeries({ durationS: 600, value: (t) => t * 3 }),
      },
    })
    const s = rangeSummary(a, { startS: 300, endS: 600 })
    expect(s.avgHr).toBe(160)
    expect(s.durationS).toBe(300)
    expect(s.distanceM).toBe(599 * 3 - 300 * 3) // cumulative distance within the range
  })
})

describe('activitySummary', () => {
  it('keeps whole-activity duration and distance even when trimmed', () => {
    const a = syntheticActivity({
      durationS: 600,
      channels: {
        heartRate: syntheticSeries({ durationS: 600, value: (t) => (t < 300 ? 100 : 160) }),
        distance: syntheticSeries({ durationS: 600, value: (t) => t * 3 }),
      },
      exclusions: { warmupEndS: 300, cooldownStartS: 600 },
    })
    const s = activitySummary(a)
    expect(s.durationS).toBe(600) // NOT the trimmed 300
    expect(s.distanceM).toBe(599 * 3) // whole-run total, not the in-window delta
    expect(s.avgHr).toBe(160) // average still respects the exclusion
  })

  it('summarizes present channels and nulls absent ones', () => {
    const a = syntheticActivity({
      durationS: 600,
      channels: {
        heartRate: syntheticSeries({ durationS: 600, value: () => 150 }),
        speed: syntheticSeries({ durationS: 600, value: () => 3 }),
        distance: syntheticSeries({ durationS: 600, value: (t) => t * 3 }),
      },
    })
    const s = activitySummary(a)
    expect(s.durationS).toBe(600)
    expect(s.avgHr).toBe(150)
    expect(s.avgSpeed).toBe(3)
    expect(s.avgPower).toBeNull()
    expect(s.distanceM).toBe(599 * 3) // cumulative channel: last sample is the total
  })

  it('respects exclusions for averages', () => {
    const a = syntheticActivity({
      durationS: 600,
      channels: {
        heartRate: syntheticSeries({ durationS: 600, value: (t) => (t < 300 ? 100 : 150) }),
      },
      exclusions: { warmupEndS: 300, cooldownStartS: 600 },
    })
    expect(activitySummary(a).avgHr).toBe(150)
  })

  it('handles an activity with no channels', () => {
    const s = activitySummary(syntheticActivity({ durationS: 60 }))
    expect(s.avgHr).toBeNull()
    expect(s.distanceM).toBeNull()
  })

  it('nulls averages when the channel has no samples in range', () => {
    const a = syntheticActivity({
      durationS: 600,
      channels: { heartRate: makeSeries([0, 1], [150, 151]) },
      exclusions: { warmupEndS: 300, cooldownStartS: 600 },
    })
    expect(activitySummary(a).avgHr).toBeNull()
  })
})
