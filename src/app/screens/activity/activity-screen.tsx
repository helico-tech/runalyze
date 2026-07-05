import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useStore as useZustand } from 'zustand'
import type { Activity, TestResult } from '../../../domain/model/types'
import type { LibraryRepository } from '../../../domain/ports/library-repository'
import { channelsPresent, driftChannelLabel } from '../../channels'
import { useContainer } from '../../container-context'
import { formatDuration } from '../../format'
import { ChartStack } from './chart-stack'
import { NotesPanel } from './notes-panel'
import { StatsPanel } from './stats-panel'
import { TestPanel } from './test-panel'
import { suggestTestWindow, TEST_WINDOW_ID, type TestKind } from './test-window'
import { createWorkspaceStore, type WorkspaceStore } from './workspace-store'
import { useWorkspacePersistence } from './use-workspace-persistence'
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

  if (loading) return <p className="text-ink-muted">Loading…</p>
  if (!activity)
    return (
      <p className="text-ink-muted">
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
  const visible = useZustand(store, (s) => s.visible)
  const driftChannel = useZustand(store, (s) => s.driftChannel)
  const sectors = useZustand(store, (s) => s.sectors)
  const exclusions = useZustand(store, (s) => s.exclusions)
  const selectedSectorId = useZustand(store, (s) => s.selectedSectorId)
  const activeTest = useZustand(store, (s) => s.activeTest)
  const present = useMemo(() => channelsPresent(activity), [activity])
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
    void repo.saveTestResult(result)
    toast.success(`Saved ${result.kind.toUpperCase()} test`)
    store.getState().cancelTest()
  }

  const saveNote = useCallback(
    (text: string) => void repo.saveNote({ activityId: activity.id, text, updatedAt: new Date() }),
    [repo, activity.id],
  )

  return (
    <div className="space-y-4">
      <Link to="/" className="font-mono text-xs uppercase tracking-widest text-ink-muted">
        ← library
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        {present.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => store.getState().toggleChannel(c.key)}
            className={cn(
              'rounded border px-2 py-1 font-mono text-xs',
              visible.has(c.key) ? 'border-line bg-surface-2' : 'border-line/50 text-ink-muted',
            )}
            style={visible.has(c.key) ? { color: c.colorHex } : undefined}
          >
            {c.label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2 font-mono text-xs text-ink-muted">
          drift
          {(['speed', 'power'] as const).map((d) => (
            <button
              key={d}
              type="button"
              disabled={d === 'power' && !activity.channels.power}
              onClick={() => store.getState().setDriftChannel(d)}
              className={cn(
                'rounded border border-line px-2 py-1',
                driftChannel === d ? 'bg-surface-2 text-ink' : 'text-ink-muted',
                d === 'power' && !activity.channels.power && 'opacity-40',
              )}
            >
              {driftChannelLabel(d)}
            </button>
          ))}
        </span>
      </div>

      <div className="flex items-center gap-2 font-mono text-xs text-ink-muted">
        analysis
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
              'rounded border border-line px-2 py-1',
              activeTest === kind ? 'bg-surface-2 text-ink' : 'text-ink-muted',
              suggestions[kind] === null && 'opacity-40',
            )}
          >
            {kind === 'aet' ? 'AeT test' : 'AnT test'}
          </button>
        ))}
      </div>

      {userSectors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {userSectors.map((s) => (
            <span
              key={s.id}
              className={cn(
                'flex items-center gap-2 rounded border px-2 py-1 font-mono text-xs',
                s.id === selectedSectorId ? 'border-focus text-ink' : 'border-line text-ink-muted',
              )}
            >
              <button type="button" onClick={() => store.getState().select(s.id)}>
                {formatDuration(s.range.startS)}–{formatDuration(s.range.endS)}
              </button>
              <button
                type="button"
                aria-label="delete sector"
                onClick={() => store.getState().removeSector(s.id)}
                className="text-ink-muted hover:text-danger"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ChartStack activity={activity} store={store} />
        <div className="space-y-6">
          {activeTest && testWindow ? (
            <TestPanel
              activity={activity}
              kind={activeTest}
              window={testWindow}
              driftChannel={driftChannel}
              onSave={handleSaveResult}
              onCancel={() => store.getState().cancelTest()}
            />
          ) : (
            <StatsPanel
              activity={activity}
              sectors={userSectors}
              exclusions={exclusions}
              driftChannel={driftChannel}
              selectedSectorId={selectedSectorId}
            />
          )}
          <NotesPanel initialText={initialNote} onSave={saveNote} />
        </div>
      </div>
    </div>
  )
}
