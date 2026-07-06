import { useMemo } from 'react'
import { assessAds } from '../../../domain/analysis/ads-assessment'
import { ADS_GAP_THRESHOLD_PCT } from '../../../domain/analysis/protocol-constants'
import type { AetTestResult, AntTestResult, TestResult } from '../../../domain/model/types'
import { ConfirmButton } from '../../components/confirm-button'
import { useContainer } from '../../container-context'
import { useTestResults } from '../../hooks'
import { formatBpm, formatDate } from '../../format'
import { AdsVerdict } from './ads-verdict'
import { TrendChart } from './trend-chart'
import type { Point } from './trends-geometry'

export function TrendsScreen() {
  const { repo, renderer } = useContainer()
  const { results, refresh } = useTestResults()

  const adsStatus = useMemo(() => assessAds(results, new Date()), [results])

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
    // Pa:HR decoupling where present, else Pw:HR
    const decoupling: Point[] = aets
      .map((r) => ({ t: r.testDate.getTime(), pct: (r.pace ?? r.power)?.decouplingPct }))
      .filter((p): p is Point & { pct: number } => p.pct !== undefined)
      .map((p) => ({ t: p.t, v: p.pct }))
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
      <p className="mx-auto max-w-5xl text-sm text-ink-muted">
        No test history yet. Run an AeT or AnT test from a run to start tracking trends.
      </p>
    )
  }

  const log = [...results].sort((a, b) => b.testDate.getTime() - a.testDate.getTime())
  const keyValue = (r: TestResult) => {
    if (r.kind === 'ant') return formatBpm(r.antHr)
    const parts = [
      r.pace ? `Pa ${r.pace.decouplingPct.toFixed(1)}%` : null,
      r.power ? `Pw ${r.power.decouplingPct.toFixed(1)}%` : null,
    ].filter(Boolean)
    return `${parts.join(' · ')} · ${formatBpm(r.aetHr)}`
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <AdsVerdict status={adsStatus} renderer={renderer} />
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

      <section>
        <h2 className="mb-2 font-mono text-xs font-semibold uppercase tracking-widest text-ink-muted">
          Test log
        </h2>
        <table className="w-full border-collapse font-mono text-sm">
          <tbody>
            {log.map((r) => (
              <tr key={r.id} className="border-b border-line/50">
                <td className="py-2 pr-4 text-ink-muted">{formatDate(r.testDate)}</td>
                <td className="py-2 pr-4 uppercase">{r.kind}</td>
                <td className="py-2 pr-4 tabular-nums">{keyValue(r)}</td>
                <td className="py-2 text-right">
                  <ConfirmButton
                    label="Delete"
                    confirmLabel="Confirm"
                    onConfirm={() => {
                      void repo.deleteTestResult(r.id).then(refresh)
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
