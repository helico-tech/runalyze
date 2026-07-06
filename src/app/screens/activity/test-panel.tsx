import { useState } from 'react'
import {
  buildAetResult,
  evaluateAetTest,
  type AetChannelEval,
  type AetEvaluation,
} from '../../../domain/analysis/aet-protocol'
import {
  buildAntResult,
  evaluateAntTest,
  type AntEvaluation,
} from '../../../domain/analysis/ant-protocol'
import type { Activity, TestResult, TimeRange } from '../../../domain/model/types'
import type { ImageRenderer } from '../../../domain/ports/image-renderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatBpm, formatDate, formatDuration } from '../../format'
import { ExportPreview } from '../../export/export-preview'
import { TestExportCard } from '../../export/export-card'
import type { TestKind } from './test-window'

const AET_GUIDANCE: Record<string, string> = {
  'above-aet': 'Test HR was above AeT. Retest about 5 bpm lower.',
  'at-aet': 'This window sits at AeT. AeT HR ≈ the window average HR.',
  'below-aet': 'At or below AeT. AeT is at least this HR — retest higher to bracket it.',
}
const AET_LABEL: Record<string, string> = {
  'above-aet': 'Above AeT',
  'at-aet': 'At AeT',
  'below-aet': 'Below AeT',
}
const WARNING_TEXT: Record<string, string> = {
  'window-too-short': 'Window is too short for a valid test.',
  'overlaps-exclusion': 'Window overlaps a trimmed region.',
  'gaps-in-window': 'Recording gaps inside the window.',
}

export function TestPanel({
  activity,
  kind,
  window,
  onSave,
  onCancel,
  renderer,
}: {
  activity: Activity
  kind: TestKind
  window: TimeRange
  onSave: (r: TestResult) => void
  onCancel: () => void
  renderer?: ImageRenderer
}) {
  const [accept, setAccept] = useState(false)
  const [showExport, setShowExport] = useState(false)
  let evaluation: AetEvaluation | AntEvaluation | null = null
  let error: string | null = null
  try {
    evaluation =
      kind === 'aet' ? evaluateAetTest(activity, window) : evaluateAntTest(activity, window)
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  const buildResult = (): TestResult => {
    // Deterministic id: one result per (activity, kind). Re-saving overwrites, so an
    // activity can never hold two of the same test.
    const id = `${activity.id}-${kind}`
    const createdAt = new Date()
    return kind === 'aet'
      ? buildAetResult({
          id,
          activity,
          window,
          evaluation: evaluation as AetEvaluation,
          createdAt,
          acceptAetHr: accept,
        })
      : buildAntResult({ id, activity, window, evaluation: evaluation as AntEvaluation, createdAt })
  }

  const save = () => {
    if (!evaluation) return
    onSave(buildResult())
  }

  const aet = kind === 'aet' && evaluation ? (evaluation as AetEvaluation) : null
  const showAccept = aet !== null && !aet.atAet && aet.valid

  return (
    <div className="space-y-4 rounded-xl border border-line bg-panel p-4 font-mono text-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-3">
          {kind === 'aet' ? 'AeT test' : 'AnT test'} · {formatDuration(window.endS - window.startS)}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-fg-3 transition-colors hover:text-fg"
        >
          ×
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {aet && <AetBody e={aet} />}
      {evaluation && kind === 'ant' && <AntBody e={evaluation as AntEvaluation} />}

      {evaluation && evaluation.warnings.length > 0 && (
        <ul className="space-y-1">
          {evaluation.warnings.map((w) => (
            <li key={w} className="text-xs text-caution">
              {WARNING_TEXT[w]}
            </li>
          ))}
        </ul>
      )}

      {showAccept && (
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
          Accept the window average as my AeT HR anyway
        </label>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        {renderer && evaluation && evaluation.valid && (
          <Button variant="outline" size="sm" onClick={() => setShowExport(true)}>
            Export
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          disabled={!evaluation || !evaluation.valid}
          onClick={save}
        >
          Save result
        </Button>
      </div>

      {showExport && renderer && evaluation && (
        <ExportPreview
          filename={`runalyze-${kind}-${formatDate(activity.startTime)}.png`}
          renderer={renderer}
          onClose={() => setShowExport(false)}
        >
          <TestExportCard activity={activity} result={buildResult()} />
        </ExportPreview>
      )}
    </div>
  )
}

function ChannelRow({ label, ch }: { label: string; ch: AetChannelEval | null }) {
  if (!ch) {
    return (
      <div className="flex items-baseline justify-between">
        <span className="text-ink-muted">{label}</span>
        <span className="text-ink-muted">—</span>
      </div>
    )
  }
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-ink-muted">{label}</span>
        <span className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">
            {ch.decoupling.decouplingPct.toFixed(1)}%
          </span>
          <Badge
            variant={
              ch.verdict === 'at-aet' ? 'ok' : ch.verdict === 'above-aet' ? 'danger' : 'caution'
            }
          >
            {AET_LABEL[ch.verdict]}
          </Badge>
        </span>
      </div>
      <p className="text-[11px] text-ink-muted">{AET_GUIDANCE[ch.verdict]}</p>
    </div>
  )
}

function AetBody({ e }: { e: AetEvaluation }) {
  return (
    <div className="space-y-3">
      <ChannelRow label="Pa:HR" ch={e.pace} />
      <ChannelRow label="Pw:HR" ch={e.power} />
      <p className="text-xs">
        Window avg HR <span className="text-ch-hr">{formatBpm(e.windowAvgHr)}</span>
        {e.suggestedAetHr !== null && (
          <>
            {' · '}AeT HR <span className="text-ch-hr">{formatBpm(e.suggestedAetHr)}</span>
          </>
        )}
      </p>
    </div>
  )
}

function AntBody({ e }: { e: AntEvaluation }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-3xl font-semibold tabular-nums text-ch-hr">{formatBpm(e.antHr)}</span>
        <Badge variant="ok">AnT HR</Badge>
      </div>
      <p className="text-xs text-ink-muted">Average HR over the final 20 minutes of the effort.</p>
      <p className="text-xs">
        Window avg HR <span className="text-ch-hr">{formatBpm(e.windowAvgHr)}</span>
      </p>
    </div>
  )
}
