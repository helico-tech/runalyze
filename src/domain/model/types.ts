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

export type LapTrigger = 'manual' | 'auto' | 'session-end'

export interface Lap {
  index: number
  range: TimeRange
  trigger: LapTrigger
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
  laps: Lap[]
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

export interface AetChannelResult {
  decouplingPct: number
  verdict: AetVerdict
}

export interface AetTestResult {
  kind: 'aet'
  id: string
  activityId: string
  testDate: Date
  createdAt: Date
  window: TimeRange
  /** Pa:HR (speed drift) — null when speed is absent or unusable */
  pace: AetChannelResult | null
  /** Pw:HR (power drift) — null when power is absent or unusable */
  power: AetChannelResult | null
  windowAvgHr: number
  /** window avg HR, set when either channel is at-aet (or the user accepted); integer bpm */
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
