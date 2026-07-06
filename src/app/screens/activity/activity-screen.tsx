import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useStore as useZustand } from 'zustand'
import type { Activity, TestResult } from '../../../domain/model/types'
import type { LibraryRepository } from '../../../domain/ports/library-repository'
import { channelsPresent, efficiencyPresent } from '../../channels'
import { ConfirmButton } from '../../components/confirm-button'
import { useContainer } from '../../container-context'
import { useTestResults, useThresholds } from '../../hooks'
import { formatBpm, formatDuration } from '../../format'
import { ChartStack } from './chart-stack'
import { HoverReadout } from './hover-readout'
import { LapTable } from './lap-table'
import { NotesPanel } from './notes-panel'
import { SplitsPanel } from './splits-panel'
import { StatsPanel } from './stats-panel'
import { TestPanel } from './test-panel'
import { suggestTestWindow, TEST_WINDOW_ID, type TestKind } from './test-window'
import { createWorkspaceStore, type WorkspaceStore } from './workspace-store'
import { useWorkspacePersistence } from './use-workspace-persistence'
import { ZonesPanel } from './zones-panel'
import { cn } from '@/lib/utils'

export function ActivityScreen() {
  const { id } = useParams<{ id: string }>()
  const { repo } = useContainer()
  const [store] = useState(() => createWorkspaceStore())
  const [activity, setActivity] = useState<Activity | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!id) return
    let alive = true
    void (async () => {
      const a = await repo.getActivity(id)
      if (!alive) return
      if (a) {
        const sectors = await repo.listSectors(id)
        const n = await repo.getNote(id)
        store.getState().init(a, sectors)
        setActivity(a)
        setNote(n?.text ?? '')
        setReady(true)
      }
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [repo, id, store])

  useWorkspacePersistence(store, repo, id ?? '', ready)

  if (loading) return <p className="mx-auto max-w-5xl text-ink-muted">Loading…</p>
  if (!activity)
    return (
      <p className="mx-auto max-w-5xl text-ink-muted">
        Run not found.{' '}
        <Link to="/" className="text-ink underline">
          Back to library
        </Link>
      </p>
    )

  return <Workspace activity={activity} store={store} initialNote={note} repo={repo} />
}

function Workspace({
  activity,
  store,
  initialNote,
  repo,
}: {
  activity: Activity
  store: WorkspaceStore
  initialNote: string
  repo: LibraryRepository
}) {
  const { renderer } = useContainer()
  const { results, refresh: refreshResults } = useTestResults()
  const { thresholds, save: saveThresholds } = useThresholds()
  const activityTests = results.filter((r) => r.activityId === activity.id)
  const visible = useZustand(store, (s) => s.visible)
  const sectors = useZustand(store, (s) => s.sectors)
  const exclusions = useZustand(store, (s) => s.exclusions)
  const selectedSectorId = useZustand(store, (s) => s.selectedSectorId)
  const activeTest = useZustand(store, (s) => s.activeTest)
  const present = useMemo(() => channelsPresent(activity), [activity])
  const effPresent = useMemo(() => efficiencyPresent(activity), [activity])
  const testWindow = sectors.find((s) => s.id === TEST_WINDOW_ID)?.range ?? null
  const userSectors = sectors.filter((s) => s.id !== TEST_WINDOW_ID)
  const suggestions = useMemo(
    () => ({
      aet: suggestTestWindow(activity, 'aet'),
      ant: suggestTestWindow(activity, 'ant'),
    }),
    [activity],
  )

  const beginTest = (kind: TestKind) => {
    const w = suggestions[kind]
    if (w) store.getState().startTest(kind, w, activity.id)
  }

  const handleSaveResult = (result: TestResult) => {
    void repo.saveTestResult(result).then(refreshResults)
    toast.success(`Saved ${result.kind.toUpperCase()} test`)
    store.getState().cancelTest()
  }

  const deleteTest = (id: string) => {
    void repo.deleteTestResult(id).then(refreshResults)
  }

  const testKeyValue = (r: TestResult) => {
    if (r.kind === 'ant') return formatBpm(r.antHr)
    const parts = [
      r.pace ? `Pa ${r.pace.decouplingPct.toFixed(1)}%` : null,
      r.power ? `Pw ${r.power.decouplingPct.toFixed(1)}%` : null,
    ].filter(Boolean)
    return `${parts.join(' · ')} · ${formatBpm(r.aetHr)}`
  }

  const saveNote = useCallback(
    (text: string) => void repo.saveNote({ activityId: activity.id, text, updatedAt: new Date() }),
    [repo, activity.id],
  )

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-fg-3 transition-colors hover:text-fg"
      >
        ← Library
      </Link>

      {/* Controls + hover readout stay pinned below the sticky header while charts scroll. */}
      <div className="sticky top-14 z-20 space-y-3 bg-bg pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {[...present, ...effPresent].map((c) => {
            const on = visible.has(c.key)
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => store.getState().toggleChannel(c.key)}
                className={cn(
                  'flex h-8 items-center gap-2 rounded-lg border px-3 text-[12.5px] font-medium transition-colors',
                  on
                    ? 'border-line-2 bg-panel-2'
                    : 'border-line text-fg-3 hover:border-line-2 hover:text-fg-2',
                )}
                style={on ? { color: c.colorVar } : undefined}
              >
                <span
                  className="h-1.5 w-1.5 flex-none rounded-full"
                  style={{ background: on ? c.colorVar : 'var(--fg-3)' }}
                />
                {c.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 text-[12.5px]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-3">
            Analysis
          </span>
          {(['aet', 'ant'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              disabled={suggestions[kind] === null}
              title={
                suggestions[kind] === null
                  ? 'This run is too short or has no heart rate for this test'
                  : undefined
              }
              onClick={() => beginTest(kind)}
              className={cn(
                'flex h-8 items-center rounded-lg border px-3 font-medium transition-colors',
                activeTest === kind
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line text-fg-2 hover:border-line-2 hover:text-fg',
                suggestions[kind] === null && 'opacity-40',
              )}
            >
              {kind === 'aet' ? 'AeT test' : 'AnT test'}
            </button>
          ))}
        </div>

        {activityTests.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-3">
              Saved tests
            </span>
            {activityTests.map((r) => (
              <span
                key={r.id}
                className="flex h-8 items-center gap-2 rounded-lg border border-line bg-panel px-3"
              >
                <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold uppercase text-accent">
                  {r.kind}
                </span>
                <span className="font-mono tabular-nums text-fg-2">{testKeyValue(r)}</span>
                <ConfirmButton
                  label="Delete"
                  confirmLabel="Confirm"
                  onConfirm={() => deleteTest(r.id)}
                />
              </span>
            ))}
          </div>
        )}

        {userSectors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {userSectors.map((s) => (
              <span
                key={s.id}
                className={cn(
                  'flex h-8 items-center gap-2 rounded-lg border px-3 font-mono text-[12px]',
                  s.id === selectedSectorId ? 'border-accent text-accent' : 'border-line text-fg-2',
                )}
              >
                <button type="button" onClick={() => store.getState().select(s.id)}>
                  {formatDuration(s.range.startS)}–{formatDuration(s.range.endS)}
                </button>
                <button
                  type="button"
                  aria-label="delete sector"
                  onClick={() => store.getState().removeSector(s.id)}
                  className="text-fg-3 transition-colors hover:text-danger"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <HoverReadout activity={activity} store={store} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <ChartStack activity={activity} store={store} />
        <div className="space-y-6">
          {activeTest && testWindow ? (
            <TestPanel
              activity={activity}
              kind={activeTest}
              window={testWindow}
              onSave={handleSaveResult}
              onCancel={() => store.getState().cancelTest()}
              renderer={renderer}
            />
          ) : (
            <StatsPanel
              activity={activity}
              sectors={userSectors}
              exclusions={exclusions}
              selectedSectorId={selectedSectorId}
            />
          )}
          <LapTable activity={activity} />
          <SplitsPanel activity={activity} />
          <ZonesPanel
            activity={activity}
            thresholds={thresholds}
            tests={results}
            onSave={saveThresholds}
          />
          <NotesPanel initialText={initialNote} onSave={saveNote} />
        </div>
      </div>
    </div>
  )
}
