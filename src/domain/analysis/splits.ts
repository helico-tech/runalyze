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

/** Raw altitude gain/loss over a range; null when altitude is absent. */
function elevation(a: Activity, range: TimeRange): { gain: number | null; loss: number | null } {
  const alt = a.channels.altitude
  if (!alt) return { gain: null, loss: null }
  let gain = 0
  let loss = 0
  let prev: number | null = null
  for (let i = 0; i < alt.t.length; i++) {
    const ti = alt.t[i]!
    if (ti < range.startS) continue
    if (ti >= range.endS) break
    const vi = alt.v[i]!
    if (!Number.isFinite(vi)) continue
    if (prev !== null) {
      const d = vi - prev
      if (d > 0) gain += d
      else loss -= d
    }
    prev = vi
  }
  return { gain, loss }
}

export function computeSplits(a: Activity): Split[] {
  const dist = a.channels.distance
  if (!dist || dist.t.length < 2) return []
  const startDist = dist.v[0]!
  const total = dist.v[dist.v.length - 1]! - startDist
  if (total <= 0) return []

  const nSplits = Math.ceil(total / SPLIT_M)
  const splits: Split[] = []
  for (let i = 0; i < nSplits; i++) {
    const dLo = startDist + i * SPLIT_M
    const dHi = Math.min(startDist + (i + 1) * SPLIT_M, startDist + total)
    const range: TimeRange = { startS: timeAtDistance(dist, dLo), endS: timeAtDistance(dist, dHi) }
    const distanceM = dHi - dLo
    const elev = elevation(a, range)
    splits.push({
      index: i,
      range,
      distanceM,
      partial: distanceM < SPLIT_M - 0.5,
      summary: rangeSummary(a, range),
      gapSpeed: gradeAdjustedSpeed(a, range),
      elevGainM: elev.gain,
      elevLossM: elev.loss,
    })
  }
  return splits
}
