import { nearestIndex } from '../../../domain/model/series'
import type { Activity } from '../../../domain/model/types'
import { CHANNELS, type DisplayChannel } from '../../channels'

export interface HoverValue {
  key: DisplayChannel
  label: string
  colorHex: string
  text: string
}

export function channelValuesAt(activity: Activity, tS: number): HoverValue[] {
  const out: HoverValue[] = []
  for (const c of CHANNELS) {
    const series = activity.channels[c.sourceChannel]
    if (!series || series.t.length === 0) continue
    const i = nearestIndex(series.t, tS)
    if (i < 0) continue
    out.push({ key: c.key, label: c.label, colorHex: c.colorHex, text: c.format(series.v[i]!) })
  }
  return out
}
