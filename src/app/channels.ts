import type { Activity, ChannelKind } from '../domain/model/types'
import { formatPace } from './format'

export type DisplayChannel =
  | 'heartRate'
  | 'pace'
  | 'power'
  | 'cadence'
  | 'altitude'
  | 'efPace'
  | 'efPower'

export interface ChannelMeta {
  key: DisplayChannel
  sourceChannel: ChannelKind
  label: string
  colorHex: string
  invert: boolean
  format(v: number): string
}

export const CHANNELS: ChannelMeta[] = [
  {
    key: 'heartRate',
    sourceChannel: 'heartRate',
    label: 'Heart rate',
    colorHex: '#ff6b6b',
    invert: false,
    format: (v) => String(Math.round(v)),
  },
  {
    key: 'pace',
    sourceChannel: 'speed',
    label: 'Pace',
    colorHex: '#4cc9f0',
    invert: true,
    format: (v) => formatPace(v).replace(' /km', ''),
  },
  {
    key: 'power',
    sourceChannel: 'power',
    label: 'Power',
    colorHex: '#a78bfa',
    invert: false,
    format: (v) => String(Math.round(v)),
  },
  {
    key: 'cadence',
    sourceChannel: 'cadence',
    label: 'Cadence',
    colorHex: '#ffc53d',
    invert: false,
    format: (v) => String(Math.round(v)),
  },
  {
    key: 'altitude',
    sourceChannel: 'altitude',
    label: 'Altitude',
    colorHex: '#6bcb77',
    invert: false,
    format: (v) => String(Math.round(v)),
  },
]

export function channelsPresent(a: Activity): ChannelMeta[] {
  return CHANNELS.filter((c) => a.channels[c.sourceChannel] !== undefined)
}

/** Efficiency curves (output/HR over time) — derived, not raw channels. */
export interface EfficiencyMeta {
  key: 'efPace' | 'efPower'
  label: string
  colorHex: string
  /** the output channel divided by HR */
  requires: ChannelKind
  /** unit scale: pace 60 (m/min per bpm), power 1 (W per bpm) */
  scale: number
  format(v: number): string
}

export const EFFICIENCY: EfficiencyMeta[] = [
  {
    key: 'efPace',
    label: 'Pa:HR eff',
    colorHex: '#2dd4bf',
    requires: 'speed',
    scale: 60,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'efPower',
    label: 'Pw:HR eff',
    colorHex: '#c084fc',
    requires: 'power',
    scale: 1,
    format: (v) => v.toFixed(2),
  },
]

export function efficiencyPresent(a: Activity): EfficiencyMeta[] {
  if (!a.channels.heartRate) return []
  return EFFICIENCY.filter((e) => a.channels[e.requires] !== undefined)
}
