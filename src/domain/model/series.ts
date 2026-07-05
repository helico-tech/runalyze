import type { Activity, Exclusions, Series, TimeRange } from './types'

export function makeSeries(t: ArrayLike<number>, v: ArrayLike<number>): Series {
  if (t.length !== v.length) {
    throw new Error(`series arrays must have equal length (got ${t.length} and ${v.length})`)
  }
  const tArr = Float64Array.from(t)
  for (let i = 1; i < tArr.length; i++) {
    if (tArr[i]! <= tArr[i - 1]!) {
      throw new Error(`series timestamps must be strictly increasing (index ${i})`)
    }
  }
  return { t: tArr, v: Float64Array.from(v) }
}

export function rangeLengthS(r: TimeRange): number {
  return r.endS - r.startS
}

export function defaultExclusions(durationS: number): Exclusions {
  return { warmupEndS: 0, cooldownStartS: durationS }
}

export function nonExcludedRange(a: Activity): TimeRange {
  return { startS: a.exclusions.warmupEndS, endS: a.exclusions.cooldownStartS }
}

export function overlapsExclusion(a: Activity, w: TimeRange): boolean {
  return w.startS < a.exclusions.warmupEndS || w.endS > a.exclusions.cooldownStartS
}

/** Index of the sample whose time is nearest `target`; −1 for an empty array. */
export function nearestIndex(t: Float64Array, target: number): number {
  const n = t.length
  if (n === 0) return -1
  let lo = 0
  let hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (t[mid]! < target) lo = mid + 1
    else hi = mid
  }
  if (lo > 0 && Math.abs(t[lo - 1]! - target) <= Math.abs(t[lo]! - target)) return lo - 1
  return lo
}
