import { describe, expect, it } from 'vitest'
import { makeSeries } from '../model/series'
import { syntheticActivity } from '../testing/synthetic'
import { computeSplits } from './splits'

/** 3 m/s over 900 s → 2700 m: two full km + a 700 m partial. */
function rampActivity() {
  const t = Array.from({ length: 901 }, (_, i) => i)
  return syntheticActivity({
    durationS: 901,
    channels: {
      distance: makeSeries(t, t.map((s) => s * 3)),
      heartRate: makeSeries(t, t.map(() => 150)),
      altitude: makeSeries(t, t.map(() => 100)),
    },
  })
}

describe('computeSplits', () => {
  it('returns [] without a distance channel', () => {
    const a = syntheticActivity({ durationS: 100 })
    expect(computeSplits(a)).toEqual([])
  })

  it('buckets into full km plus a flagged partial', () => {
    const splits = computeSplits(rampActivity())
    expect(splits.map((s) => s.partial)).toEqual([false, false, true])
    expect(splits[0]!.distanceM).toBeCloseTo(1000, 0)
    expect(splits[2]!.distanceM).toBeCloseTo(700, 0)
  })

  it('each split time range is ~1000/3 s except the partial', () => {
    const splits = computeSplits(rampActivity())
    expect(splits[0]!.range.endS - splits[0]!.range.startS).toBeCloseTo(1000 / 3, 0)
  })

  it('reports flat GAP equal to real speed and zero elevation', () => {
    const splits = computeSplits(rampActivity())
    expect(splits[0]!.gapSpeed!).toBeCloseTo(3, 1)
    expect(splits[0]!.elevGainM).toBe(0)
    expect(splits[0]!.elevLossM).toBe(0)
  })

  it('leaves GAP/elevation null when altitude is absent', () => {
    const t = Array.from({ length: 901 }, (_, i) => i)
    const a = syntheticActivity({
      durationS: 901,
      channels: { distance: makeSeries(t, t.map((s) => s * 3)) },
    })
    const splits = computeSplits(a)
    expect(splits[0]!.gapSpeed).toBeNull()
    expect(splits[0]!.elevGainM).toBeNull()
  })

  it('counts elevation gain that straddles a split boundary (seam not dropped)', () => {
    // Split 0/1 boundary lands at t≈333.33s (1000m at 3 m/s). Put a +50m rise
    // exactly between the samples at t=333 and t=334, which straddles that seam.
    const t = Array.from({ length: 901 }, (_, i) => i)
    const a = syntheticActivity({
      durationS: 901,
      channels: {
        distance: makeSeries(t, t.map((s) => s * 3)),
        altitude: makeSeries(
          t,
          t.map((s) => (s < 334 ? 100 : 150)),
        ),
      },
    })
    const splits = computeSplits(a)
    const gainSum = splits.reduce((sum, s) => sum + (s.elevGainM ?? 0), 0)
    const lossSum = splits.reduce((sum, s) => sum + (s.elevLossM ?? 0), 0)
    expect(gainSum).toBeCloseTo(50, 6)
    expect(lossSum).toBeCloseTo(0, 6)
  })

  it('conserves whole-run elevation gain/loss across split seams', () => {
    // ~2.5km at 3 m/s with a wiggly altitude profile; splits must sum to
    // exactly what a single naive pass over the whole altitude series gets.
    const t = Array.from({ length: 834 }, (_, i) => i)
    const altV = t.map((s) => 100 + 10 * Math.sin(s / 20))
    const a = syntheticActivity({
      durationS: 834,
      channels: {
        distance: makeSeries(t, t.map((s) => s * 3)),
        altitude: makeSeries(t, altV),
      },
    })
    const splits = computeSplits(a)
    const gainSum = splits.reduce((sum, s) => sum + (s.elevGainM ?? 0), 0)
    const lossSum = splits.reduce((sum, s) => sum + (s.elevLossM ?? 0), 0)

    let naiveGain = 0
    let naiveLoss = 0
    for (let i = 1; i < altV.length; i++) {
      const d = altV[i]! - altV[i - 1]!
      if (d > 0) naiveGain += d
      else naiveLoss -= d
    }

    expect(gainSum).toBeCloseTo(naiveGain, 6)
    expect(lossSum).toBeCloseTo(naiveLoss, 6)
  })
})
