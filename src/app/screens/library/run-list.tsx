import { Link, useNavigate } from 'react-router-dom'
import { activitySummary } from '../../../domain/analysis/activity-summary'
import type { Activity } from '../../../domain/model/types'
import { Badge } from '@/components/ui/badge'
import { ConfirmButton } from '../../components/confirm-button'
import { formatBpm, formatDate, formatDistanceKm, formatDuration, formatPace } from '../../format'

export function RunList({
  activities,
  badges,
  onDelete,
}: {
  activities: Activity[]
  badges: Map<string, string[]>
  onDelete?: (id: string) => void
}) {
  const navigate = useNavigate()
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-panel py-14 text-center text-sm text-fg-3">
        No runs yet.
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <table className="w-full border-collapse text-sm tabular-nums">
        <thead>
          <tr className="border-b border-line bg-panel-2 text-left text-[11px] uppercase tracking-[0.04em] text-fg-3">
            <th className="px-4 py-2.5 font-semibold">Date</th>
            <th className="px-4 py-2.5 font-semibold">Sport</th>
            <th className="px-4 py-2.5 font-semibold">Duration</th>
            <th className="px-4 py-2.5 font-semibold">Distance</th>
            <th className="px-4 py-2.5 font-semibold">Avg HR</th>
            <th className="px-4 py-2.5 font-semibold">Pace</th>
            <th className="px-4 py-2.5 font-semibold">Tests</th>
            <th className="px-4 py-2.5 font-semibold"></th>
          </tr>
        </thead>
        <tbody>
          {activities.map((a) => {
            const s = activitySummary(a)
            return (
              <tr
                key={a.id}
                onClick={() => navigate(`/activity/${a.id}`)}
                className="cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-sunk"
              >
                <td className="px-4 py-2.5">
                  <Link
                    to={`/activity/${a.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-fg hover:text-accent"
                  >
                    {formatDate(a.startTime)}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-fg-2">{a.sport}</td>
                <td className="px-4 py-2.5 font-mono">{formatDuration(s.durationS)}</td>
                <td className="px-4 py-2.5 font-mono">{formatDistanceKm(s.distanceM)}</td>
                <td className="px-4 py-2.5 font-mono text-ch-hr">{formatBpm(s.avgHr)}</td>
                <td className="px-4 py-2.5 font-mono text-ch-pace">
                  {s.avgSpeed === null ? '–' : formatPace(s.avgSpeed)}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    {(badges.get(a.id) ?? []).map((b) => (
                      <Badge key={b} variant="accent">
                        {b}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {onDelete && (
                    <ConfirmButton
                      label="Delete run"
                      confirmLabel="Confirm delete"
                      onConfirm={() => onDelete(a.id)}
                    />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
