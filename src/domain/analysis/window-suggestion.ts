import type { Activity, TimeRange } from '../model/types'
import { nonExcludedRange, rangeLengthS } from '../model/series'
import { MAX_GAP_IN_WINDOW_S, WINDOW_SUGGESTION_STEP_S } from './protocol-constants'
import { uncoveredS, windowStdDev } from './stats'

export interface SuggestOpts {
  targetLengthS: number
  minLengthS: number
}

export function suggestWindow(activity: Activity, opts: SuggestOpts): TimeRange | null {
  const hr = activity.channels.heartRate
  if (!hr) return null

  const span = nonExcludedRange(activity)
  const spanLen = rangeLengthS(span)
  if (spanLen < opts.minLengthS) return null
  if (spanLen < opts.targetLengthS) return span

  let best: TimeRange | null = null
  let bestStdDev = Infinity
  let bestAny: TimeRange | null = null
  let bestAnyStdDev = Infinity

  for (let s = span.startS; s <= span.endS - opts.targetLengthS; s += WINDOW_SUGGESTION_STEP_S) {
    const cand: TimeRange = { startS: s, endS: s + opts.targetLengthS }
    const sd = windowStdDev(hr, cand)
    if (Number.isNaN(sd)) continue
    if (sd < bestAnyStdDev) {
      bestAnyStdDev = sd
      bestAny = cand
    }
    if (uncoveredS(hr, cand) > MAX_GAP_IN_WINDOW_S) continue
    if (sd < bestStdDev) {
      bestStdDev = sd
      best = cand
    }
  }

  return best ?? bestAny
}
