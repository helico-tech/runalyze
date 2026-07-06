import { computeDecoupling } from '../../../domain/analysis/decoupling'
import { gradeAdjustedSpeed } from '../../../domain/analysis/grade-adjusted-pace'
import { sectorStats } from '../../../domain/analysis/sector-stats'
import { windowStats } from '../../../domain/analysis/stats'
import { nonExcludedRange } from '../../../domain/model/series'
import type { Activity, Exclusions, Sector, TimeRange } from '../../../domain/model/types'
import { CHANNELS } from '../../channels'
import { formatDuration, formatPace } from '../../format'

function decouplingText(a: Activity, range: TimeRange, drift: 'speed' | 'power'): string {
  const out = a.channels[drift]
  const hr = a.channels.heartRate
  if (!out || !hr) return '—'
  try {
    return `${computeDecoupling(out, hr, range).decouplingPct.toFixed(1)}%`
  } catch {
    return '—'
  }
}

function ChannelRows({ a, range }: { a: Activity; range: TimeRange }) {
  return (
    <>
      {CHANNELS.filter((c) => a.channels[c.sourceChannel]).map((c) => {
        const st = windowStats(a.channels[c.sourceChannel]!, range)
        return (
          <tr key={c.key} className="border-b border-line/40">
            <td className="py-1 pr-4" style={{ color: c.colorVar }}>
              {c.label}
            </td>
            <td className="py-1 pr-4 text-right tabular-nums">
              {Number.isNaN(st.mean) ? '—' : c.format(st.mean)}
            </td>
            <td className="py-1 text-right tabular-nums text-ink-muted">
              {Number.isNaN(st.max) ? '—' : c.format(st.max)}
            </td>
          </tr>
        )
      })}
    </>
  )
}

export function StatsPanel({
  activity,
  sectors,
  exclusions,
  selectedSectorId,
}: {
  activity: Activity
  sectors: Sector[]
  exclusions: Exclusions
  selectedSectorId: string | null
}) {
  const whole = nonExcludedRange({ ...activity, exclusions })
  const selected = sectors.find((s) => s.id === selectedSectorId) ?? null

  return (
    <div className="space-y-6 font-mono text-sm">
      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-3">
          Whole run · {formatDuration(whole.endS - whole.startS)}
        </h3>
        <div className="rounded-xl border border-line bg-panel p-4">
          <table className="w-full">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.04em] text-fg-3">
                <th className="py-1 text-left font-semibold">Channel</th>
                <th className="py-1 text-right font-semibold">Avg</th>
                <th className="py-1 text-right font-semibold">Max</th>
              </tr>
            </thead>
            <tbody>
              <ChannelRows a={activity} range={whole} />
            </tbody>
          </table>
          {(() => {
            const gap = gradeAdjustedSpeed(activity, whole)
            return gap === null ? null : (
              <p className="mt-3 flex justify-between border-t border-line pt-2 text-[11px] uppercase tracking-[0.04em] text-fg-3">
                <span>GAP</span>
                <span className="tabular-nums text-ch-pace">{formatPace(gap)}</span>
              </p>
            )
          })()}
        </div>
      </section>

      {selected && <SectorStatsBlock activity={activity} range={selected.range} />}
    </div>
  )
}

function SectorStatsBlock({ activity, range }: { activity: Activity; range: TimeRange }) {
  const stats = sectorStats(activity, range)
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-3">
        Sector · {formatDuration(range.endS - range.startS)}
      </h3>
      <div className="rounded-xl border border-line bg-panel p-4">
        <p className="mb-2 text-[11px] uppercase tracking-[0.04em] text-fg-3">Decoupling</p>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(['speed', 'power'] as const).map((drift) => (
            <div
              key={drift}
              className="flex items-baseline justify-between rounded-lg border border-line bg-panel-2 px-3 py-2"
            >
              <span className="text-[10.5px] uppercase tracking-[0.04em] text-fg-3">
                {drift === 'speed' ? 'Pa:HR' : 'Pw:HR'}
              </span>
              <span className="text-lg tabular-nums">{decouplingText(activity, range, drift)}</span>
            </div>
          ))}
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.04em] text-fg-3">
              <th className="py-1 text-left font-semibold">Channel</th>
              <th className="py-1 text-right font-semibold">1st half</th>
              <th className="py-1 text-right font-semibold">2nd half</th>
            </tr>
          </thead>
          <tbody>
            {CHANNELS.filter((c) => stats[c.sourceChannel]).map((c) => {
              const cs = stats[c.sourceChannel]!
              return (
                <tr key={c.key} className="border-b border-line/40 last:border-0">
                  <td className="py-1 pr-4" style={{ color: c.colorVar }}>
                    {c.label}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {Number.isNaN(cs.firstHalf.mean) ? '—' : c.format(cs.firstHalf.mean)}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {Number.isNaN(cs.secondHalf.mean) ? '—' : c.format(cs.secondHalf.mean)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
