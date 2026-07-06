import { nearestIndex } from '../model/series'
import type { Activity, TimeRange } from '../model/types'

const SMOOTH_WINDOW_M = 30

/** Minetti et al. (2002) cost of running (J/kg/m) at gradient i (rise/run). */
export function runningCost(i: number): number {
  return 155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6
}

const FLAT_COST = runningCost(0)

/**
 * Equivalent-flat speed (m/s) over the range, adjusting for grade via the
 * Minetti cost curve. Grade is computed over ≥30 m segments to suppress GPS
 * altitude noise. Returns null when distance or altitude is missing or the
 * range carries no forward distance.
 */
export function gradeAdjustedSpeed(a: Activity, range: TimeRange): number | null {
  const dist = a.channels.distance
  const alt = a.channels.altitude
  if (!dist || !alt || dist.t.length < 2 || alt.t.length < 1) return null

  const idx: number[] = []
  for (let i = 0; i < dist.t.length; i++) {
    const ti = dist.t[i]!
    if (ti < range.startS) continue
    if (ti >= range.endS) break
    idx.push(i)
  }
  if (idx.length < 2) return null

  const altAt = (tS: number): number => alt.v[nearestIndex(alt.t, tS)]!

  let equivFlat = 0
  let j = 0
  while (j < idx.length - 1) {
    let k = j + 1
    while (k < idx.length - 1 && dist.v[idx[k]!]! - dist.v[idx[j]!]! < SMOOTH_WINDOW_M) k++
    const dDist = dist.v[idx[k]!]! - dist.v[idx[j]!]!
    if (dDist > 0) {
      const dAlt = altAt(dist.t[idx[k]!]!) - altAt(dist.t[idx[j]!]!)
      const grade = dAlt / dDist
      equivFlat += dDist * (runningCost(grade) / FLAT_COST)
    }
    j = k
  }

  const elapsed = dist.t[idx[idx.length - 1]!]! - dist.t[idx[0]!]!
  if (equivFlat <= 0 || elapsed <= 0) return null
  return equivFlat / elapsed
}
