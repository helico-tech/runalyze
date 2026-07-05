import type { Activity, ChannelKind } from '../model/types'
import { nonExcludedRange } from '../model/series'
import { windowStats } from './stats'

export interface ActivitySummary {
  durationS: number
  distanceM: number | null
  avgHr: number | null
  avgSpeed: number | null
  avgPower: number | null
}

export function activitySummary(a: Activity): ActivitySummary {
  const range = nonExcludedRange(a)
  const avg = (kind: ChannelKind): number | null => {
    const series = a.channels[kind]
    if (!series) return null
    const stats = windowStats(series, range)
    return stats.weightS > 0 ? stats.mean : null
  }
  // distance is cumulative from activity start: the last sample is the total
  const distance = a.channels.distance
  const distanceM = distance && distance.v.length > 0 ? distance.v[distance.v.length - 1]! : null
  return {
    durationS: a.durationS,
    distanceM,
    avgHr: avg('heartRate'),
    avgSpeed: avg('speed'),
    avgPower: avg('power'),
  }
}
