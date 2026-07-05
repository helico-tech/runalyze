import type { Activity, ChannelKind, DriftChannel } from '../domain/model/types'
import { formatPace } from './format'

export type DisplayChannel = 'heartRate' | 'pace' | 'power' | 'cadence' | 'altitude'

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

/** The DriftChannel selector (speed|power) maps to these display channels' sources. */
export function driftChannelLabel(c: DriftChannel): string {
  return c === 'speed' ? 'Pace (Pa:HR)' : 'Power (Pw:HR)'
}

export function channelsPresent(a: Activity): ChannelMeta[] {
  return CHANNELS.filter((c) => a.channels[c.sourceChannel] !== undefined)
}
