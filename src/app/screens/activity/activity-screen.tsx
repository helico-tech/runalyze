import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { activitySummary } from '../../../domain/analysis/activity-summary'
import type { Activity } from '../../../domain/model/types'
import { useContainer } from '../../container-context'
import { formatBpm, formatDate, formatDistanceKm, formatDuration, formatPace } from '../../format'

export function ActivityScreen() {
  const { id } = useParams<{ id: string }>()
  const { repo } = useContainer()
  const [activity, setActivity] = useState<Activity | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    void repo.getActivity(id).then((a) => {
      setActivity(a)
      setLoading(false)
    })
  }, [repo, id])

  if (loading) return <p className="text-ink-muted">Loading…</p>
  if (!activity) {
    return (
      <p className="text-ink-muted">
        Run not found.{' '}
        <Link to="/" className="text-ink underline">
          Back to library
        </Link>
      </p>
    )
  }
  const s = activitySummary(activity)
  return (
    <div className="space-y-4">
      <Link to="/" className="font-mono text-xs uppercase tracking-widest text-ink-muted">
        ← library
      </Link>
      <h1 className="font-mono text-2xl tabular-nums">
        {formatDate(activity.startTime)} · {activity.sport}
      </h1>
      <p className="font-mono text-sm text-ink-muted">
        {formatDuration(s.durationS)} · {formatDistanceKm(s.distanceM)} ·{' '}
        <span className="text-ch-hr">{formatBpm(s.avgHr)}</span> ·{' '}
        <span className="text-ch-pace">{s.avgSpeed === null ? '–' : formatPace(s.avgSpeed)}</span>
      </p>
      <p className="text-sm text-ink-muted">
        The analysis workspace (charts, sectors, tests) arrives in milestone 4.
      </p>
    </div>
  )
}
