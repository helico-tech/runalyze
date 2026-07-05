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
