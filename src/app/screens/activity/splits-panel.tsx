import { computeSplits } from '../../../domain/analysis/splits'
import type { Activity } from '../../../domain/model/types'
import { formatBpm, formatDuration, formatPace } from '../../format'

export function SplitsPanel({ activity }: { activity: Activity }) {
  const splits = computeSplits(activity)
  if (splits.length === 0) return null

  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-3">
        Splits
      </h3>
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        <table className="w-full border-collapse text-[13px] tabular-nums">
          <thead>
            <tr className="border-b border-line bg-panel-2 text-left text-[11px] uppercase tracking-[0.04em] text-fg-3">
              <th className="px-3 py-2 font-semibold">Km</th>
              <th className="px-3 py-2 font-semibold">Time</th>
              <th className="px-3 py-2 font-semibold">Pace</th>
              <th className="px-3 py-2 font-semibold">GAP</th>
              <th className="px-3 py-2 font-semibold">HR</th>
              <th className="px-3 py-2 font-semibold">Elev</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {splits.map((s) => (
              <tr
                key={s.index}
                className="border-b border-line last:border-0 transition-colors hover:bg-sunk"
              >
                <td className="px-3 py-2 text-fg-3">
                  {s.index + 1}
                  {s.partial && <span className="ml-1 text-caution">partial</span>}
                </td>
                <td className="px-3 py-2">{formatDuration(s.range.endS - s.range.startS)}</td>
                <td className="px-3 py-2 text-ch-pace">
                  {s.summary.avgSpeed === null ? '–' : formatPace(s.summary.avgSpeed)}
                </td>
                <td className="px-3 py-2 text-ch-pace">
                  {s.gapSpeed === null ? '–' : formatPace(s.gapSpeed)}
                </td>
                <td className="px-3 py-2 text-ch-hr">{formatBpm(s.summary.avgHr)}</td>
                <td className="px-3 py-2">
                  {s.elevGainM === null
                    ? '–'
                    : `+${Math.round(s.elevGainM)}/−${Math.round(s.elevLossM ?? 0)} m`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
