import { useState } from 'react'
import {
  buildAetResult,
  evaluateAetTest,
  type AetEvaluation,
} from '../../../domain/analysis/aet-protocol'
import {
  buildAntResult,
  evaluateAntTest,
  type AntEvaluation,
} from '../../../domain/analysis/ant-protocol'
import type { Activity, DriftChannel, TestResult, TimeRange } from '../../../domain/model/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatBpm, formatDuration } from '../../format'
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
  driftChannel,
  onSave,
  onCancel,
}: {
  activity: Activity
  kind: TestKind
  window: TimeRange
  driftChannel: DriftChannel
  onSave: (r: TestResult) => void
  onCancel: () => void
}) {
  const [accept, setAccept] = useState(false)
  let evaluation: AetEvaluation | AntEvaluation | null = null
  let error: string | null = null
  try {
    evaluation =
      kind === 'aet'
        ? evaluateAetTest(activity, window, driftChannel)
        : evaluateAntTest(activity, window)
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  const save = () => {
    if (!evaluation) return
    const id = crypto.randomUUID()
    const createdAt = new Date()
    if (kind === 'aet') {
      onSave(
        buildAetResult({
          id,
          activity,
          window,
          driftChannel,
          evaluation: evaluation as AetEvaluation,
          createdAt,
          acceptAetHr: accept,
        }),
      )
    } else {
      onSave(
        buildAntResult({
          id,
          activity,
          window,
          evaluation: evaluation as AntEvaluation,
          createdAt,
        }),
      )
    }
  }

  const aet = kind === 'aet' && evaluation ? (evaluation as AetEvaluation) : null
  const aboveAet = aet?.verdict === 'above-aet'
  const showAccept = aet !== null && aet.verdict !== 'at-aet' && aet.valid

  return (
    <div className="space-y-4 rounded-lg border border-line bg-surface p-4 font-mono text-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
          {kind === 'aet' ? 'AeT test' : 'AnT test'} · {formatDuration(window.endS - window.startS)}
        </h3>
        <button type="button" onClick={onCancel} className="text-ink-muted hover:text-ink">
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
        <label
          className={cn(
            'flex items-center gap-2 text-xs',
            aboveAet ? 'text-caution' : 'text-ink-muted',
          )}
        >
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
          {aboveAet
            ? 'Force-accept this HR as AeT despite it being above AeT'
            : 'Accept the window average as my AeT HR anyway'}
        </label>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={!evaluation || !evaluation.valid} onClick={save}>
          Save result
        </Button>
      </div>
    </div>
  )
}

function AetBody({ e }: { e: AetEvaluation }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-3xl font-semibold tabular-nums">
          {e.decoupling.decouplingPct.toFixed(1)}%
        </span>
        <Badge
          variant={e.verdict === 'at-aet' ? 'ok' : e.verdict === 'above-aet' ? 'danger' : 'caution'}
        >
          {AET_LABEL[e.verdict]}
        </Badge>
      </div>
      <p className="text-xs text-ink-muted">{AET_GUIDANCE[e.verdict]}</p>
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
