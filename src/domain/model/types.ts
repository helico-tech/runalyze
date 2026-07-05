export type ChannelKind =
  | 'heartRate'
  | 'speed'
  | 'power'
  | 'cadence'
  | 'altitude'
  | 'distance'
  | 'temperature'

export interface Series {
  /** seconds relative to activity start, strictly increasing */
  t: Float64Array
  v: Float64Array
}

/** Half-open: a sample at time t is inside iff startS <= t < endS */
export interface TimeRange {
  startS: number
  endS: number
}

export interface Exclusions {
  warmupEndS: number
  cooldownStartS: number
}

export interface Activity {
  /** content hash of the source file */
  id: string
  startTime: Date
  durationS: number
  sport: string
  device: string | null
  channels: Partial<Record<ChannelKind, Series>>
  exclusions: Exclusions
}

export interface Sector {
  id: string
  activityId: string
  range: TimeRange
  label: string
  kind: 'sector' | 'test-window'
}

export type DriftChannel = 'speed' | 'power'

export type AetVerdict = 'above-aet' | 'at-aet' | 'below-aet'

export interface AetTestResult {
  kind: 'aet'
  id: string
  activityId: string
  testDate: Date
  createdAt: Date
  window: TimeRange
  driftChannel: DriftChannel
  decouplingPct: number
  windowAvgHr: number
  verdict: AetVerdict
  /** set when verdict is at-aet, or when the user explicitly accepted; integer bpm */
  aetHr: number | null
}

export interface AntTestResult {
  kind: 'ant'
  id: string
  activityId: string
  testDate: Date
  createdAt: Date
  window: TimeRange
  /** integer bpm */
  antHr: number
  windowAvgHr: number
  /** informational, sample-weighted over the window; null when the channel is absent or empty */
  windowAvgSpeed: number | null
  windowAvgPower: number | null
}

export type TestResult = AetTestResult | AntTestResult

export interface Note {
  activityId: string
  text: string
  updatedAt: Date
}
