import { rangeSummary, type ActivitySummary } from './activity-summary'
import { gradeAdjustedSpeed } from './grade-adjusted-pace'
import type { Activity, Series, TimeRange } from '../model/types'

const SPLIT_M = 1000

export interface Split {
  index: number
  range: TimeRange
  distanceM: number
  partial: boolean
  summary: ActivitySummary
  gapSpeed: number | null
  elevGainM: number | null
  elevLossM: number | null
}

/** Time at a cumulative-distance target, linearly interpolated. dist.v is monotone non-decreasing. */
function timeAtDistance(dist: Series, target: number): number {
  const { t, v } = dist
  if (target <= v[0]!) return t[0]!
  if (target >= v[v.length - 1]!) return t[t.length - 1]!
  let lo = 0
  let hi = v.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (v[mid]! < target) lo = mid + 1
    else hi = mid
  }
  const d0 = v[lo - 1]!
  const d1 = v[lo]!
  const frac = d1 > d0 ? (target - d0) / (d1 - d0) : 0
  return t[lo - 1]! + frac * (t[lo]! - t[lo - 1]!)
}

/**
 * Attributes every consecutive altitude delta to exactly one split range, so that
 * gain/loss straddling a split seam is counted once (not dropped by both neighbors,
 * as a naive per-split walk over the half-open range would do). Each delta is
 * assigned to the split whose `[startS, endS)` range contains the EARLIER sample's
 * time; since altitude timestamps and split ranges are both increasing, a single
 * monotonic pointer suffices — no rescanning needed.
 */
function attributeElevation(
  a: Activity,
  ranges: readonly TimeRange[],
): { gain: number | null; loss: number | null }[] {
  const alt = a.channels.altitude
  if (!alt || ranges.length === 0) {
    return ranges.map(() => ({ gain: null, loss: null }))
  }

  const gains = new Array<number>(ranges.length).fill(0)
  const losses = new Array<number>(ranges.length).fill(0)

  let splitIdx = 0
  for (let i = 1; i < alt.t.length; i++) {
    const vPrev = alt.v[i - 1]!
    const vCur = alt.v[i]!
    if (!Number.isFinite(vPrev) || !Number.isFinite(vCur)) continue

    const tPrev = alt.t[i - 1]!
    while (splitIdx < ranges.length - 1 && tPrev >= ranges[splitIdx]!.endS) {
      splitIdx++
    }

    const delta = vCur - vPrev
    if (delta > 0) gains[splitIdx]! += delta
    else if (delta < 0) losses[splitIdx]! += -delta
  }

  return ranges.map((_, i) => ({ gain: gains[i]!, loss: losses[i]! }))
}

export function computeSplits(a: Activity): Split[] {
  const dist = a.channels.distance
  if (!dist || dist.t.length < 2) return []
  const startDist = dist.v[0]!
  const total = dist.v[dist.v.length - 1]! - startDist
  if (total <= 0) return []

  const nSplits = Math.ceil(total / SPLIT_M)
  const ranges: TimeRange[] = []
  const distances: number[] = []
  for (let i = 0; i < nSplits; i++) {
    const dLo = startDist + i * SPLIT_M
    const dHi = Math.min(startDist + (i + 1) * SPLIT_M, startDist + total)
    ranges.push({ startS: timeAtDistance(dist, dLo), endS: timeAtDistance(dist, dHi) })
    distances.push(dHi - dLo)
  }

  const elev = attributeElevation(a, ranges)

  return ranges.map((range, i) => ({
    index: i,
    range,
    distanceM: distances[i]!,
    partial: distances[i]! < SPLIT_M - 0.5,
    summary: rangeSummary(a, range),
    gapSpeed: gradeAdjustedSpeed(a, range),
    elevGainM: elev[i]!.gain,
    elevLossM: elev[i]!.loss,
  }))
}
