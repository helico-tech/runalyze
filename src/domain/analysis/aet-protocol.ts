import type { Activity, AetTestResult, AetVerdict, DriftChannel, TimeRange } from '../model/types'
import { overlapsExclusion, rangeLengthS } from '../model/series'
import { computeDecoupling, type DecouplingResult } from './decoupling'
import {
  AET_DECOUPLING_AT_MAX,
  AET_DECOUPLING_AT_MIN,
  AET_MIN_WINDOW_S,
  MAX_GAP_IN_WINDOW_S,
} from './protocol-constants'
import { windowStats } from './stats'

export type AetWarning = 'window-too-short' | 'overlaps-exclusion' | 'gaps-in-window'

export interface AetEvaluation {
  decoupling: DecouplingResult
  windowAvgHr: number
  verdict: AetVerdict
  warnings: AetWarning[]
  valid: boolean
  suggestedAetHr: number | null
}

export function aetVerdict(decouplingPct: number): AetVerdict {
  if (decouplingPct > AET_DECOUPLING_AT_MAX) return 'above-aet'
  if (decouplingPct >= AET_DECOUPLING_AT_MIN) return 'at-aet'
  return 'below-aet'
}

export function evaluateAetTest(
  activity: Activity,
  window: TimeRange,
  driftChannel: DriftChannel,
): AetEvaluation {
  const output = activity.channels[driftChannel]
  if (!output) throw new Error(`missing channel: ${driftChannel}`)
  const hr = activity.channels.heartRate
  if (!hr) throw new Error('missing channel: heartRate')

  const decoupling = computeDecoupling(output, hr, window)
  const windowAvgHr = windowStats(hr, window).mean
  const verdict = aetVerdict(decoupling.decouplingPct)

  const warnings: AetWarning[] = []
  if (rangeLengthS(window) < AET_MIN_WINDOW_S) warnings.push('window-too-short')
  if (overlapsExclusion(activity, window)) warnings.push('overlaps-exclusion')
  if (decoupling.uncoveredS > MAX_GAP_IN_WINDOW_S) warnings.push('gaps-in-window')

  return {
    decoupling,
    windowAvgHr,
    verdict,
    warnings,
    valid: !warnings.includes('window-too-short') && !warnings.includes('overlaps-exclusion'),
    suggestedAetHr: verdict === 'at-aet' ? Math.round(windowAvgHr) : null,
  }
}

export interface BuildAetArgs {
  id: string
  activity: Activity
  window: TimeRange
  driftChannel: DriftChannel
  evaluation: AetEvaluation
  createdAt: Date
  /** user explicitly accepts windowAvgHr as AeT despite a non-at-aet verdict */
  acceptAetHr?: boolean
}

export function buildAetResult(args: BuildAetArgs): AetTestResult {
  const { evaluation } = args
  if (!evaluation.valid) throw new Error('cannot save an invalid AeT test')
  return {
    kind: 'aet',
    id: args.id,
    activityId: args.activity.id,
    testDate: args.activity.startTime,
    createdAt: args.createdAt,
    window: args.window,
    driftChannel: args.driftChannel,
    decouplingPct: evaluation.decoupling.decouplingPct,
    windowAvgHr: evaluation.windowAvgHr,
    verdict: evaluation.verdict,
    aetHr:
      evaluation.suggestedAetHr ?? (args.acceptAetHr ? Math.round(evaluation.windowAvgHr) : null),
  }
}
