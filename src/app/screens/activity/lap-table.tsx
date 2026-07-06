import { rangeSummary } from '../../../domain/analysis/activity-summary'
import { displayLaps } from '../../../domain/model/laps'
import type { Activity } from '../../../domain/model/types'
import { formatBpm, formatDistanceKm, formatDuration, formatPace } from '../../format'

export function LapTable({ activity }: { activity: Activity }) {
  const laps = displayLaps(activity)
  if (laps.length === 0) return null

  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-3">Laps</h3>
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        <table className="w-full border-collapse text-[13px] tabular-nums">
          <thead>
            <tr className="border-b border-line bg-panel-2 text-left text-[11px] uppercase tracking-[0.04em] text-fg-3">
              <th className="px-3 py-2 font-semibold">Lap</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Time</th>
              <th className="px-3 py-2 font-semibold">Dist</th>
              <th className="px-3 py-2 font-semibold">HR</th>
              <th className="px-3 py-2 font-semibold">Pace</th>
              <th className="px-3 py-2 font-semibold">Pwr</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {laps.map((lap, i) => {
              const s = rangeSummary(activity, lap.range)
              return (
                <tr
                  key={lap.index}
                  className="border-b border-line last:border-0 transition-colors hover:bg-sunk"
                >
                  <td className="px-3 py-2 text-fg-3">L{i + 1}</td>
                  <td className="px-3 py-2">
                    <span className={lap.trigger === 'manual' ? 'text-caution' : 'text-fg-3'}>
                      {lap.trigger}
                    </span>
                  </td>
                  <td className="px-3 py-2">{formatDuration(s.durationS)}</td>
                  <td className="px-3 py-2">{formatDistanceKm(s.distanceM)}</td>
                  <td className="px-3 py-2 text-ch-hr">{formatBpm(s.avgHr)}</td>
                  <td className="px-3 py-2 text-ch-pace">
                    {s.avgSpeed === null ? '–' : formatPace(s.avgSpeed)}
                  </td>
                  <td className="px-3 py-2 text-ch-power">
                    {s.avgPower === null ? '–' : Math.round(s.avgPower)}
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
