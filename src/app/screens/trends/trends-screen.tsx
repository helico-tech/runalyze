import { useMemo } from 'react'
import { ADS_GAP_THRESHOLD_PCT } from '../../../domain/analysis/protocol-constants'
import type { AetTestResult, AntTestResult } from '../../../domain/model/types'
import { useTestResults } from '../../hooks'
import { TrendChart } from './trend-chart'
import type { Point } from './trends-geometry'

export function TrendsScreen() {
  const { results } = useTestResults()

  const { aetHr, antHr, decoupling, gap } = useMemo(() => {
    const aets = results
      .filter((r): r is AetTestResult => r.kind === 'aet')
      .sort((a, b) => a.testDate.getTime() - b.testDate.getTime())
    const ants = results
      .filter((r): r is AntTestResult => r.kind === 'ant')
      .sort((a, b) => a.testDate.getTime() - b.testDate.getTime())
    const aetHr: Point[] = aets
      .filter((r) => r.aetHr !== null)
      .map((r) => ({ t: r.testDate.getTime(), v: r.aetHr! }))
    const antHr: Point[] = ants.map((r) => ({ t: r.testDate.getTime(), v: r.antHr }))
    const decoupling: Point[] = aets.map((r) => ({ t: r.testDate.getTime(), v: r.decouplingPct }))
    // ADS gap over time: pair each AnT with the most recent prior AeT that has an HR
    const gap: Point[] = ants
      .map((ant): Point | null => {
        const aet = [...aets]
          .reverse()
          .find((a) => a.aetHr !== null && a.testDate.getTime() <= ant.testDate.getTime())
        if (!aet) return null
        return { t: ant.testDate.getTime(), v: ((ant.antHr - aet.aetHr!) / ant.antHr) * 100 }
      })
      .filter((p): p is Point => p !== null)
    return { aetHr, antHr, decoupling, gap }
  }, [results])

  if (results.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No test history yet. Run an AeT or AnT test from a run to start tracking trends.
      </p>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TrendChart title="AeT HR" unit="bpm" points={aetHr} colorHex="#ff6b6b" />
      <TrendChart title="AnT HR" unit="bpm" points={antHr} colorHex="#ff6b6b" />
      <TrendChart title="AeT decoupling" unit="%" points={decoupling} colorHex="#4cc9f0" />
      <TrendChart
        title="ADS gap"
        unit="%"
        points={gap}
        colorHex="#a78bfa"
        yMin={0}
        threshold={ADS_GAP_THRESHOLD_PCT}
      />
    </div>
  )
}
