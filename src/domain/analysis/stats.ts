import type { Series, TimeRange } from '../model/types'
import { rangeLengthS } from '../model/series'
import { GAP_THRESHOLD_S } from './protocol-constants'

export interface WeightedStats {
  mean: number
  min: number
  max: number
  /** seconds of the range covered by weighted samples */
  weightS: number
  /** seconds attributed to sample deltas exceeding GAP_THRESHOLD_S */
  gapS: number
  /** finite samples inside the range */
  sampleCount: number
}

export function windowStats(series: Series, range: TimeRange): WeightedStats {
  const { t, v } = series
  const n = t.length
  let weightedSum = 0
  let weightS = 0
  let gapS = 0
  let min = Infinity
  let max = -Infinity
  let sampleCount = 0

  for (let i = 0; i < n; i++) {
    const ti = t[i]!
    if (ti < range.startS) continue
    if (ti >= range.endS) break
    const vi = v[i]!
    if (!Number.isFinite(vi)) continue
    sampleCount++
    if (vi < min) min = vi
    if (vi > max) max = vi
    const next = i + 1 < n ? t[i + 1]! : range.endS
    const rawDelta = next - ti
    const span = Math.min(rawDelta, range.endS - ti)
    if (rawDelta > GAP_THRESHOLD_S) {
      gapS += span
    } else {
      weightedSum += vi * span
      weightS += span
    }
  }

  return {
    mean: weightS > 0 ? weightedSum / weightS : NaN,
    min: sampleCount > 0 ? min : NaN,
    max: sampleCount > 0 ? max : NaN,
    weightS,
    gapS,
    sampleCount,
  }
}

/** Population stddev over finite in-range samples, unweighted. NaN if none. */
export function windowStdDev(series: Series, range: TimeRange): number {
  const { t, v } = series
  let sum = 0
  let sumSq = 0
  let count = 0
  for (let i = 0; i < t.length; i++) {
    const ti = t[i]!
    if (ti < range.startS) continue
    if (ti >= range.endS) break
    const vi = v[i]!
    if (!Number.isFinite(vi)) continue
    sum += vi
    sumSq += vi * vi
    count++
  }
  if (count === 0) return NaN
  const mean = sum / count
  return Math.sqrt(Math.max(0, sumSq / count - mean * mean))
}

/** Seconds of the range not covered by weighted samples: gaps, dropouts, missing spans. */
export function uncoveredS(series: Series, range: TimeRange): number {
  return Math.max(0, rangeLengthS(range) - windowStats(series, range).weightS)
}

export function splitHalves(range: TimeRange): { first: TimeRange; second: TimeRange } {
  const mid = (range.startS + range.endS) / 2
  return {
    first: { startS: range.startS, endS: mid },
    second: { startS: mid, endS: range.endS },
  }
}
