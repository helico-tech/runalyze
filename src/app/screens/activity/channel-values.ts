import { nearestIndex } from '../../../domain/model/series'
import type { Activity } from '../../../domain/model/types'
import { CHANNELS, EFFICIENCY, type DisplayChannel } from '../../channels'

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
  const hr = activity.channels.heartRate
  if (hr && hr.t.length > 0) {
    for (const e of EFFICIENCY) {
      const output = activity.channels[e.requires]
      if (!output || output.t.length === 0) continue
      const hi = nearestIndex(hr.t, tS)
      const oi = nearestIndex(output.t, tS)
      const h = hr.v[hi]!
      const o = output.v[oi]!
      if (!Number.isFinite(h) || h <= 0 || !Number.isFinite(o)) continue
      out.push({ key: e.key, label: e.label, colorHex: e.colorHex, text: e.format((e.scale * o) / h) })
    }
  }
  return out
}
