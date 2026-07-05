import type { Activity, ChannelKind, TimeRange } from '../model/types'
import { splitHalves, windowStats, type WeightedStats } from './stats'

export interface SectorChannelStats {
  whole: WeightedStats
  firstHalf: WeightedStats
  secondHalf: WeightedStats
}

export type SectorStats = Partial<Record<ChannelKind, SectorChannelStats>>

export function sectorStats(activity: Activity, range: TimeRange): SectorStats {
  const { first, second } = splitHalves(range)
  const result: SectorStats = {}
  for (const [kind, series] of Object.entries(activity.channels)) {
    if (!series) continue
    result[kind as ChannelKind] = {
      whole: windowStats(series, range),
      firstHalf: windowStats(series, first),
      secondHalf: windowStats(series, second),
    }
  }
  return result
}
