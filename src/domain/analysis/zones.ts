import { nonExcludedRange } from '../model/series'
import type {
  Activity,
  AetTestResult,
  AntTestResult,
  TestResult,
  Thresholds,
} from '../model/types'
import { GAP_THRESHOLD_S } from './protocol-constants'

export type ZoneResult =
  | {
      ok: true
      aetHr: number
      antHr: number
      belowAetS: number
      aetToAntS: number
      aboveAntS: number
      totalS: number
    }
  | { ok: false; reason: 'no-hr' | 'no-thresholds' | 'invalid-order' }

/** Resolve a run's thresholds: a saved test on the run wins, else the global value. */
export function resolveThresholds(
  activityId: string,
  global: Thresholds | null,
  tests: TestResult[],
): { aetHr: number | null; antHr: number | null } {
  const aetTest = tests.find(
    (t): t is AetTestResult => t.kind === 'aet' && t.activityId === activityId && t.aetHr !== null,
  )
  const antTest = tests.find(
    (t): t is AntTestResult => t.kind === 'ant' && t.activityId === activityId,
  )
  return {
    aetHr: aetTest?.aetHr ?? global?.aetHr ?? null,
    antHr: antTest?.antHr ?? global?.antHr ?? null,
  }
}

/** Sample-weighted seconds in each HR zone over the non-excluded range. */
export function computeZones(
  a: Activity,
  resolved: { aetHr: number | null; antHr: number | null },
): ZoneResult {
  const hr = a.channels.heartRate
  if (!hr || hr.t.length === 0) return { ok: false, reason: 'no-hr' }
  const { aetHr, antHr } = resolved
  if (aetHr === null || antHr === null) return { ok: false, reason: 'no-thresholds' }
  if (aetHr >= antHr) return { ok: false, reason: 'invalid-order' }

  const range = nonExcludedRange(a)
  const { t, v } = hr
  const n = t.length
  let below = 0
  let mid = 0
  let above = 0
  for (let i = 0; i < n; i++) {
    const ti = t[i]!
    if (ti < range.startS) continue
    if (ti >= range.endS) break
    const vi = v[i]!
    if (!Number.isFinite(vi)) continue
    const next = i + 1 < n ? t[i + 1]! : range.endS
    const rawDelta = next - ti
    if (rawDelta > GAP_THRESHOLD_S) continue
    const span = Math.min(rawDelta, range.endS - ti)
    if (vi < aetHr) below += span
    else if (vi < antHr) mid += span
    else above += span
  }
  return { ok: true, aetHr, antHr, belowAetS: below, aetToAntS: mid, aboveAntS: above, totalS: below + mid + above }
}
