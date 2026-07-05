import { defaultExclusions, makeSeries } from '../model/series'
import type { Activity, ChannelKind, Exclusions, Lap, Series } from '../model/types'

export interface SyntheticSeriesOpts {
  durationS: number
  /** sample interval, default 1s */
  dtS?: number
  /** first sample time, default 0 */
  startS?: number
  value: (tS: number) => number
}

export function syntheticSeries(opts: SyntheticSeriesOpts): Series {
  const dt = opts.dtS ?? 1
  const start = opts.startS ?? 0
  const t: number[] = []
  const v: number[] = []
  for (let ts = start; ts < start + opts.durationS; ts += dt) {
    t.push(ts)
    v.push(opts.value(ts))
  }
  return makeSeries(t, v)
}

export interface SyntheticActivityOpts {
  durationS: number
  channels?: Partial<Record<ChannelKind, Series>>
  exclusions?: Exclusions
  laps?: Lap[]
  id?: string
  startTime?: Date
}

export function syntheticActivity(opts: SyntheticActivityOpts): Activity {
  return {
    id: opts.id ?? 'test-activity',
    startTime: opts.startTime ?? new Date('2026-07-01T08:00:00Z'),
    durationS: opts.durationS,
    sport: 'running',
    device: null,
    channels: opts.channels ?? {},
    exclusions: opts.exclusions ?? defaultExclusions(opts.durationS),
    laps: opts.laps ?? [],
  }
}
