import type {
  Activity,
  AetChannelResult,
  AetTestResult,
  AetVerdict,
  Series,
  TimeRange,
} from '../model/types'
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

export interface AetChannelEval {
  decoupling: DecouplingResult
  verdict: AetVerdict
}

export interface AetEvaluation {
  /** Pa:HR (speed drift), null when speed is absent or a window half has no data */
  pace: AetChannelEval | null
  /** Pw:HR (power drift), null when power is absent or a window half has no data */
  power: AetChannelEval | null
  windowAvgHr: number
  warnings: AetWarning[]
  valid: boolean
  /** either channel reads at-aet */
  atAet: boolean
  suggestedAetHr: number | null
}

export function aetVerdict(decouplingPct: number): AetVerdict {
  if (decouplingPct > AET_DECOUPLING_AT_MAX) return 'above-aet'
  if (decouplingPct >= AET_DECOUPLING_AT_MIN) return 'at-aet'
  return 'below-aet'
}

/** Decoupling + verdict for one drift channel; null if absent or a half has no data. */
function channelEval(output: Series | undefined, hr: Series, window: TimeRange): AetChannelEval | null {
  if (!output) return null
  try {
    const decoupling = computeDecoupling(output, hr, window)
    return { decoupling, verdict: aetVerdict(decoupling.decouplingPct) }
  } catch {
    // a present-but-sparse channel whose window half has no usable data
    return null
  }
}

export function evaluateAetTest(activity: Activity, window: TimeRange): AetEvaluation {
  const hr = activity.channels.heartRate
  if (!hr) throw new Error('missing channel: heartRate')
  if (!activity.channels.speed && !activity.channels.power) {
    throw new Error('no drift channel: needs speed or power')
  }

  const pace = channelEval(activity.channels.speed, hr, window)
  const power = channelEval(activity.channels.power, hr, window)
  const windowAvgHr = windowStats(hr, window).mean

  const uncovered = [pace, power]
    .filter((c): c is AetChannelEval => c !== null)
    .map((c) => c.decoupling.uncoveredS)
  const worstUncovered = uncovered.length > 0 ? Math.max(...uncovered) : 0

  const warnings: AetWarning[] = []
  if (rangeLengthS(window) < AET_MIN_WINDOW_S) warnings.push('window-too-short')
  if (overlapsExclusion(activity, window)) warnings.push('overlaps-exclusion')
  if (worstUncovered > MAX_GAP_IN_WINDOW_S) warnings.push('gaps-in-window')

  const atAet = pace?.verdict === 'at-aet' || power?.verdict === 'at-aet'
  return {
    pace,
    power,
    windowAvgHr,
    warnings,
    valid: !warnings.includes('window-too-short') && !warnings.includes('overlaps-exclusion'),
    atAet,
    suggestedAetHr: atAet ? Math.round(windowAvgHr) : null,
  }
}

export interface BuildAetArgs {
  id: string
  activity: Activity
  window: TimeRange
  evaluation: AetEvaluation
  createdAt: Date
  /** user explicitly accepts windowAvgHr as AeT despite no channel reading at-aet */
  acceptAetHr?: boolean
}

const channelResult = (c: AetChannelEval | null): AetChannelResult | null =>
  c ? { decouplingPct: c.decoupling.decouplingPct, verdict: c.verdict } : null

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
    pace: channelResult(evaluation.pace),
    power: channelResult(evaluation.power),
    windowAvgHr: evaluation.windowAvgHr,
    aetHr:
      evaluation.suggestedAetHr ??
      (args.acceptAetHr ? Math.round(evaluation.windowAvgHr) : null),
  }
}
