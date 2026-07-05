import { Link, useNavigate } from 'react-router-dom'
import { activitySummary } from '../../../domain/analysis/activity-summary'
import type { Activity } from '../../../domain/model/types'
import { Badge } from '@/components/ui/badge'
import { formatBpm, formatDate, formatDistanceKm, formatDuration, formatPace } from '../../format'

export function RunList({
  activities,
  badges,
}: {
  activities: Activity[]
  badges: Map<string, string[]>
}) {
  const navigate = useNavigate()
  if (activities.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-muted">No runs yet.</p>
  }
  return (
    <table className="w-full border-collapse font-mono text-sm tabular-nums">
      <thead>
        <tr className="border-b border-line text-left text-[10px] uppercase tracking-widest text-ink-muted">
          <th className="py-2 pr-4 font-medium">date</th>
          <th className="py-2 pr-4 font-medium">sport</th>
          <th className="py-2 pr-4 font-medium">duration</th>
          <th className="py-2 pr-4 font-medium">distance</th>
          <th className="py-2 pr-4 font-medium">avg hr</th>
          <th className="py-2 pr-4 font-medium">pace</th>
          <th className="py-2 font-medium">tests</th>
        </tr>
      </thead>
      <tbody>
        {activities.map((a) => {
          const s = activitySummary(a)
          return (
            <tr
              key={a.id}
              onClick={() => navigate(`/activity/${a.id}`)}
              className="cursor-pointer border-b border-line/50 hover:bg-surface"
            >
              <td className="py-2 pr-4">
                <Link
                  to={`/activity/${a.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-ink hover:underline"
                >
                  {formatDate(a.startTime)}
                </Link>
              </td>
              <td className="py-2 pr-4 text-ink-muted">{a.sport}</td>
              <td className="py-2 pr-4">{formatDuration(s.durationS)}</td>
              <td className="py-2 pr-4">{formatDistanceKm(s.distanceM)}</td>
              <td className="py-2 pr-4 text-ch-hr">{formatBpm(s.avgHr)}</td>
              <td className="py-2 pr-4 text-ch-pace">
                {s.avgSpeed === null ? '–' : formatPace(s.avgSpeed)}
              </td>
              <td className="py-2">
                {(badges.get(a.id) ?? []).map((b) => (
                  <Badge key={b} className="mr-1">
                    {b}
                  </Badge>
                ))}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
