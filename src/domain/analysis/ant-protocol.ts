import type { Activity, AntTestResult, TimeRange } from '../model/types'
import { overlapsExclusion, rangeLengthS } from '../model/series'
import { ANT_AVG_SPAN_S, ANT_MIN_WINDOW_S, MAX_GAP_IN_WINDOW_S } from './protocol-constants'
import { uncoveredS, windowStats } from './stats'

export type AntWarning = 'window-too-short' | 'overlaps-exclusion' | 'gaps-in-window'

export interface AntEvaluation {
  antHr: number
  windowAvgHr: number
  /** informational, sample-weighted over the window; null when the channel is absent or empty */
  windowAvgSpeed: number | null
  windowAvgPower: number | null
  warnings: AntWarning[]
  valid: boolean
}

export function evaluateAntTest(activity: Activity, testWindow: TimeRange): AntEvaluation {
  const hr = activity.channels.heartRate
  if (!hr) throw new Error('missing channel: heartRate')

  const avgRange: TimeRange = {
    startS: Math.max(testWindow.startS, testWindow.endS - ANT_AVG_SPAN_S),
    endS: testWindow.endS,
  }
  const antStats = windowStats(hr, avgRange)
  const whole = windowStats(hr, testWindow)
  if (antStats.weightS === 0 || whole.weightS === 0) {
    throw new Error('AnT window has no usable heart-rate data')
  }

  const infoAvg = (kind: 'speed' | 'power'): number | null => {
    const series = activity.channels[kind]
    if (!series) return null
    const stats = windowStats(series, testWindow)
    return stats.weightS > 0 ? stats.mean : null
  }

  const warnings: AntWarning[] = []
  if (rangeLengthS(testWindow) < ANT_MIN_WINDOW_S) warnings.push('window-too-short')
  if (overlapsExclusion(activity, testWindow)) warnings.push('overlaps-exclusion')
  if (uncoveredS(hr, testWindow) > MAX_GAP_IN_WINDOW_S) warnings.push('gaps-in-window')

  return {
    antHr: antStats.mean,
    windowAvgHr: whole.mean,
    windowAvgSpeed: infoAvg('speed'),
    windowAvgPower: infoAvg('power'),
    warnings,
    valid: !warnings.includes('window-too-short') && !warnings.includes('overlaps-exclusion'),
  }
}

export interface BuildAntArgs {
  id: string
  activity: Activity
  window: TimeRange
  evaluation: AntEvaluation
  createdAt: Date
}

export function buildAntResult(args: BuildAntArgs): AntTestResult {
  const { evaluation } = args
  if (!evaluation.valid) throw new Error('cannot save an invalid AnT test')
  return {
    kind: 'ant',
    id: args.id,
    activityId: args.activity.id,
    testDate: args.activity.startTime,
    createdAt: args.createdAt,
    window: args.window,
    antHr: Math.round(evaluation.antHr),
    windowAvgHr: evaluation.windowAvgHr,
    windowAvgSpeed: evaluation.windowAvgSpeed,
    windowAvgPower: evaluation.windowAvgPower,
  }
}
