import type { Activity } from '../../../domain/model/types'
import { CHANNELS, type DisplayChannel } from '../../channels'

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
  // lo is the first index with t[lo] >= target; compare with lo-1 for the nearer one
  if (lo > 0 && Math.abs(t[lo - 1]! - target) <= Math.abs(t[lo]! - target)) return lo - 1
  return lo
}

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
