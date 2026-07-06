import { useStore as useZustand } from 'zustand'
import type { Activity } from '../../../domain/model/types'
import { formatDuration } from '../../format'
import { channelValuesAt } from './channel-values'
import type { WorkspaceStore } from './workspace-store'

export function HoverReadout({ activity, store }: { activity: Activity; store: WorkspaceStore }) {
  const hoverT = useZustand(store, (s) => s.hoverT)
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line bg-panel px-3 py-1.5 font-mono text-xs">
      {hoverT === null ? (
        <span className="text-fg-3">Hover a chart for values at the cursor.</span>
      ) : (
        <>
          <span className="tabular-nums text-fg-3">@ {formatDuration(hoverT)}</span>
          {channelValuesAt(activity, hoverT).map((v) => (
            <span key={v.key} style={{ color: v.colorVar }}>
              {v.label} <span className="tabular-nums text-fg">{v.text}</span>
            </span>
          ))}
        </>
      )}
    </div>
  )
}
