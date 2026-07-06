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

const newest = <T extends { testDate: Date }>(xs: T[]): T | undefined =>
  xs.reduce<T | undefined>(
    (best, t) => (!best || t.testDate.getTime() > best.testDate.getTime() ? t : best),
    undefined,
  )

/**
 * Resolve a run's thresholds. Preference, per channel:
 *   this run's own saved test → most recent saved test on any run → manual global → null.
 * The cross-run fallback mirrors the ADS readout (spec §2.3): your latest test carries
 * forward to later runs until you retest, rather than being stranded on the run it was taken on.
 */
export function resolveThresholds(
  activityId: string,
  global: Thresholds | null,
  tests: TestResult[],
): { aetHr: number | null; antHr: number | null } {
  const aets = tests.filter((t): t is AetTestResult => t.kind === 'aet' && t.aetHr !== null)
  const ants = tests.filter((t): t is AntTestResult => t.kind === 'ant')
  const aet = aets.find((t) => t.activityId === activityId) ?? newest(aets)
  const ant = ants.find((t) => t.activityId === activityId) ?? newest(ants)
  return {
    aetHr: aet?.aetHr ?? global?.aetHr ?? null,
    antHr: ant?.antHr ?? global?.antHr ?? null,
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
