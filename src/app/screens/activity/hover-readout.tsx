import { useStore as useZustand } from 'zustand'
import type { Activity } from '../../../domain/model/types'
import { formatDuration } from '../../format'
import { channelValuesAt } from './channel-values'
import type { WorkspaceStore } from './workspace-store'

export function HoverReadout({ activity, store }: { activity: Activity; store: WorkspaceStore }) {
  const hoverT = useZustand(store, (s) => s.hoverT)
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-1 rounded border border-line bg-surface px-3 py-1.5 font-mono text-xs">
      {hoverT === null ? (
        <span className="text-ink-muted">Hover a chart for values at the cursor.</span>
      ) : (
        <>
          <span className="tabular-nums text-ink-muted">@ {formatDuration(hoverT)}</span>
          {channelValuesAt(activity, hoverT).map((v) => (
            <span key={v.key} style={{ color: v.colorHex }}>
              {v.label} <span className="tabular-nums text-ink">{v.text}</span>
            </span>
          ))}
        </>
      )}
    </div>
  )
}
