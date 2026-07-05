import { makeSeries, nearestIndex } from '../model/series'
import type { Series } from '../model/types'

/** Aerobic efficiency curve: scale × output/HR at each usable HR sample. */
export function efficiencySeries(output: Series, hr: Series, scale: number): Series {
  const t: number[] = []
  const v: number[] = []
  for (let i = 0; i < hr.t.length; i++) {
    const h = hr.v[i]!
    if (!Number.isFinite(h) || h <= 0) continue
    const oi = nearestIndex(output.t, hr.t[i]!)
    if (oi < 0) continue
    const o = output.v[oi]!
    if (!Number.isFinite(o)) continue
    t.push(hr.t[i]!)
    v.push((scale * o) / h)
  }
  return makeSeries(t, v)
}

/** Centered moving average over a ±windowS/2 time span. */
export function rollingMean(series: Series, windowS: number): Series {
  const { t, v } = series
  const n = t.length
  const out = new Float64Array(n)
  const half = windowS / 2
  let lo = 0
  let hi = 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    while (lo < n && t[lo]! < t[i]! - half) {
      sum -= v[lo]!
      lo++
    }
    while (hi < n && t[hi]! <= t[i]! + half) {
      sum += v[hi]!
      hi++
    }
    out[i] = sum / (hi - lo)
  }
  return { t: Float64Array.from(t), v: out }
}
