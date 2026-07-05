import type { Activity, ChannelKind, TimeRange } from '../model/types'
import { nearestIndex, nonExcludedRange } from '../model/series'
import { windowStats } from './stats'

export interface ActivitySummary {
  durationS: number
  distanceM: number | null
  avgHr: number | null
  avgSpeed: number | null
  avgPower: number | null
}

/** Per-channel summary over an arbitrary range (used for laps and sectors). */
export function rangeSummary(a: Activity, range: TimeRange): ActivitySummary {
  const avg = (kind: ChannelKind): number | null => {
    const series = a.channels[kind]
    if (!series) return null
    const stats = windowStats(series, range)
    return stats.weightS > 0 ? stats.mean : null
  }
  const distance = a.channels.distance
  let distanceM: number | null = null
  if (distance && distance.t.length > 0) {
    const lo = nearestIndex(distance.t, range.startS)
    const hi = nearestIndex(distance.t, range.endS)
    distanceM = distance.v[hi]! - distance.v[lo]!
  }
  return {
    durationS: range.endS - range.startS,
    distanceM,
    avgHr: avg('heartRate'),
    avgSpeed: avg('speed'),
    avgPower: avg('power'),
  }
}

/**
 * Whole-activity summary for the library: averages over the non-excluded range,
 * but duration and distance are the run's true totals (not the trimmed window).
 */
export function activitySummary(a: Activity): ActivitySummary {
  const s = rangeSummary(a, nonExcludedRange(a))
  const distance = a.channels.distance
  return {
    ...s,
    durationS: a.durationS,
    distanceM: distance && distance.v.length > 0 ? distance.v[distance.v.length - 1]! : null,
  }
}
