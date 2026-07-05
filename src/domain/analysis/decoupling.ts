import type { Series, TimeRange } from '../model/types'
import { splitHalves, uncoveredS, windowStats } from './stats'

export interface HalfRatio {
  outputMean: number
  hrMean: number
  ratio: number
}

export interface DecouplingResult {
  decouplingPct: number
  firstHalf: HalfRatio
  secondHalf: HalfRatio
  /** worst uncovered span (s) across output and HR over the whole window */
  uncoveredS: number
}

function halfRatio(output: Series, hr: Series, half: TimeRange): HalfRatio {
  const o = windowStats(output, half)
  const h = windowStats(hr, half)
  if (o.weightS === 0 || h.weightS === 0) {
    throw new Error('decoupling window has a half with no usable data')
  }
  return { outputMean: o.mean, hrMean: h.mean, ratio: o.mean / h.mean }
}

export function computeDecoupling(
  output: Series,
  hr: Series,
  window: TimeRange,
): DecouplingResult {
  const { first, second } = splitHalves(window)
  const f = halfRatio(output, hr, first)
  const s = halfRatio(output, hr, second)
  return {
    decouplingPct: ((f.ratio - s.ratio) / f.ratio) * 100,
    firstHalf: f,
    secondHalf: s,
    uncoveredS: Math.max(uncoveredS(output, window), uncoveredS(hr, window)),
  }
}
