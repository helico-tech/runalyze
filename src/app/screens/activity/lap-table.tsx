import { rangeSummary } from '../../../domain/analysis/activity-summary'
import { displayLaps } from '../../../domain/model/laps'
import type { Activity } from '../../../domain/model/types'
import { formatBpm, formatDistanceKm, formatDuration, formatPace } from '../../format'

export function LapTable({ activity }: { activity: Activity }) {
  const laps = displayLaps(activity)
  if (laps.length === 0) return null

  return (
    <section>
      <h3 className="mb-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">Laps</h3>
      <table className="w-full border-collapse font-mono text-sm tabular-nums">
        <thead>
          <tr className="border-b border-line text-left text-[10px] uppercase tracking-widest text-ink-muted">
            <th className="py-1 pr-3 font-medium">lap</th>
            <th className="py-1 pr-3 font-medium">type</th>
            <th className="py-1 pr-3 font-medium">time</th>
            <th className="py-1 pr-3 font-medium">dist</th>
            <th className="py-1 pr-3 font-medium">hr</th>
            <th className="py-1 pr-3 font-medium">pace</th>
            <th className="py-1 font-medium">pwr</th>
          </tr>
        </thead>
        <tbody>
          {laps.map((lap, i) => {
            const s = rangeSummary(activity, lap.range)
            return (
              <tr key={lap.index} className="border-b border-line/40">
                <td className="py-1 pr-3 text-ink-muted">L{i + 1}</td>
                <td className="py-1 pr-3">
                  <span className={lap.trigger === 'manual' ? 'text-caution' : 'text-ink-muted'}>
                    {lap.trigger}
                  </span>
                </td>
                <td className="py-1 pr-3">{formatDuration(s.durationS)}</td>
                <td className="py-1 pr-3">{formatDistanceKm(s.distanceM)}</td>
                <td className="py-1 pr-3 text-ch-hr">{formatBpm(s.avgHr)}</td>
                <td className="py-1 pr-3 text-ch-pace">
                  {s.avgSpeed === null ? '–' : formatPace(s.avgSpeed)}
                </td>
                <td className="py-1 text-ch-power">
                  {s.avgPower === null ? '–' : Math.round(s.avgPower)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
