import { computeSplits } from '../../../domain/analysis/splits'
import type { Activity } from '../../../domain/model/types'
import { formatBpm, formatDuration, formatPace } from '../../format'

export function SplitsPanel({ activity }: { activity: Activity }) {
  const splits = computeSplits(activity)
  if (splits.length === 0) return null

  return (
    <section>
      <h3 className="mb-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">Splits</h3>
      <table className="w-full border-collapse font-mono text-sm tabular-nums">
        <thead>
          <tr className="border-b border-line text-left text-[10px] uppercase tracking-widest text-ink-muted">
            <th className="py-1 pr-3 font-medium">km</th>
            <th className="py-1 pr-3 font-medium">time</th>
            <th className="py-1 pr-3 font-medium">pace</th>
            <th className="py-1 pr-3 font-medium">gap</th>
            <th className="py-1 pr-3 font-medium">hr</th>
            <th className="py-1 font-medium">elev</th>
          </tr>
        </thead>
        <tbody>
          {splits.map((s) => (
            <tr key={s.index} className="border-b border-line/40">
              <td className="py-1 pr-3 text-ink-muted">
                {s.index + 1}
                {s.partial && <span className="ml-1 text-caution">partial</span>}
              </td>
              <td className="py-1 pr-3">{formatDuration(s.range.endS - s.range.startS)}</td>
              <td className="py-1 pr-3 text-ch-pace">
                {s.summary.avgSpeed === null ? '–' : formatPace(s.summary.avgSpeed)}
              </td>
              <td className="py-1 pr-3 text-ch-pace">
                {s.gapSpeed === null ? '–' : formatPace(s.gapSpeed)}
              </td>
              <td className="py-1 pr-3 text-ch-hr">{formatBpm(s.summary.avgHr)}</td>
              <td className="py-1">
                {s.elevGainM === null
                  ? '–'
                  : `+${Math.round(s.elevGainM)}/−${Math.round(s.elevLossM ?? 0)} m`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
