import type { AetTestResult, AntTestResult, TestResult } from '../model/types'
import { ADS_GAP_THRESHOLD_PCT, TEST_STALE_DAYS } from './protocol-constants'

export type AdsStatus =
  | { state: 'no-tests' }
  | { state: 'missing-aet'; ant: AntTestResult }
  | { state: 'missing-ant'; aet: AetTestResult }
  | {
      state: 'assessed'
      gapPct: number
      ads: boolean
      aet: AetTestResult
      ant: AntTestResult
      aetStale: boolean
      antStale: boolean
    }

const STALE_MS = TEST_STALE_DAYS * 24 * 60 * 60 * 1000

function latest<T extends TestResult>(results: T[]): T | null {
  let best: T | null = null
  for (const r of results) {
    if (!best || r.testDate.getTime() > best.testDate.getTime()) best = r
  }
  return best
}

export function assessAds(results: TestResult[], now: Date): AdsStatus {
  const aet = latest(results.filter((r): r is AetTestResult => r.kind === 'aet' && r.aetHr !== null))
  const ant = latest(results.filter((r): r is AntTestResult => r.kind === 'ant'))

  if (!aet && !ant) return { state: 'no-tests' }
  if (!aet) return { state: 'missing-aet', ant: ant! }
  if (!ant) return { state: 'missing-ant', aet }

  const gapPct = ((ant.antHr - aet.aetHr!) / ant.antHr) * 100
  const isStale = (r: TestResult) => now.getTime() - r.testDate.getTime() > STALE_MS
  return {
    state: 'assessed',
    gapPct,
    ads: gapPct > ADS_GAP_THRESHOLD_PCT,
    aet,
    ant,
    aetStale: isStale(aet),
    antStale: isStale(ant),
  }
}
