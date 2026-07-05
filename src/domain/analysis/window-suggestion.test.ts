import { describe, expect, it } from 'vitest'
import { makeSeries } from '../model/series'
import { syntheticActivity, syntheticSeries } from '../testing/synthetic'
import { suggestWindow } from './window-suggestion'

const OPTS = { targetLengthS: 3600, minLengthS: 2700 }

describe('suggestWindow', () => {
  it('returns null without a heart-rate channel', () => {
    expect(suggestWindow(syntheticActivity({ durationS: 7200 }), OPTS)).toBeNull()
  })

  it('returns null when the non-excluded span is below the minimum', () => {
    const a = syntheticActivity({
      durationS: 2000,
      channels: { heartRate: syntheticSeries({ durationS: 2000, value: () => 150 }) },
    })
    expect(suggestWindow(a, OPTS)).toBeNull()
  })

  it('returns the whole span when shorter than the target but above the minimum', () => {
    const a = syntheticActivity({
      durationS: 3000,
      channels: { heartRate: syntheticSeries({ durationS: 3000, value: () => 150 }) },
    })
    expect(suggestWindow(a, OPTS)).toEqual({ startS: 0, endS: 3000 })
  })

  it('picks the steadiest window, earliest on ties', () => {
    const a = syntheticActivity({
      durationS: 5400,
      channels: {
        heartRate: syntheticSeries({
          durationS: 5400,
          value: (t) => (t < 1500 ? 150 + 10 * Math.sin(t / 30) : 150),
        }),
      },
      exclusions: { warmupEndS: 600, cooldownStartS: 5400 },
    })
    expect(suggestWindow(a, OPTS)).toEqual({ startS: 1500, endS: 5100 })
  })

  it('skips windows with too much uncovered time', () => {
    // constant HR but samples missing for [1000, 1200)
    const t: number[] = []
    for (let i = 0; i < 7200; i++) if (i < 1000 || i >= 1200) t.push(i)
    const hr = makeSeries(t, Array(t.length).fill(150))
    const a = syntheticActivity({ durationS: 7200, channels: { heartRate: hr } })
    // earliest start with uncovered <= 120s is 1080
    expect(suggestWindow(a, OPTS)).toEqual({ startS: 1080, endS: 4680 })
  })

  it('falls back to best-anyway when every candidate has gaps', () => {
    const t: number[] = []
    for (let i = 0; i < 4000; i++) if (i < 1800 || i >= 2400) t.push(i)
    const hr = makeSeries(t, Array(t.length).fill(150))
    const a = syntheticActivity({ durationS: 4000, channels: { heartRate: hr } })
    expect(suggestWindow(a, OPTS)).toEqual({ startS: 0, endS: 3600 })
  })
})
