# Milestone 5: Guided Test Flows + Trends — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From a run's workspace, click "AeT test" or "AnT test" to drop an auto-suggested test window you can drag; watch the verdict update live (decoupling %, band, guidance, or AnT HR); save a result that then drives the library's ADS readout, run badges, and a new Trends screen charting AeT HR / AnT HR / decoupling / ADS gap over time.

**Architecture:** The domain already computes everything (`evaluateAetTest`/`buildAetResult`, `evaluateAntTest`/`buildAntResult`, `assessAds`, `suggestWindow` — all from milestone 1). This milestone is UI wiring plus one pure SVG-geometry helper. The key simplification: **the test window is just a `kind: 'test-window'` sector**, so it reuses the entire milestone-4 drag/overlay machinery unchanged — the only new store state is which test is active. Persistence skips test-window sectors so the transient window never lands in the sectors table.

**Tech Stack:** nothing new (SVG trends chart is hand-rolled, jsdom-testable; no uPlot needed for sparse test history).

## Review amendments (apply during execution — supersede the task bodies below)

Findings from the pre-execution review panel (executed the plan to 160 green with these):

1. **AeT test assertion (Task 2, blocker):** `getByText(/at aet/i)` matches BOTH the "At AeT" badge and the "…sits at AeT…" guidance → throws. Use exact `getByText('At AeT')`.
2. **No `onSaved` prop (Task 3):** ignore the discarded prop alternative. `Workspace` keeps its signature; save via a local `handleSaveResult` (`repo.saveTestResult` → `toast.success` → `store.getState().cancelTest()`). Library refreshes on its own mount.
3. **Three startTest calls (Task 1):** the appended store test has THREE `startTest(...)` calls, not two — pass `'test-activity'` as the third arg to all three.
4. **TrendChart shared y-domain (Task 4, major):** the threshold line must scale on the SAME y-domain as the points. In TrendChart derive one domain that includes the threshold and pass it to BOTH `scalePoints` calls: `const vs = points.map(p => p.v); const lo = Math.min(yMin ?? Math.min(...vs), threshold ?? Infinity); const hi = Math.max(yMax ?? Math.max(...vs), threshold ?? -Infinity);` then `scalePoints(points, W, H, PAD, lo, hi)` and `scalePoints([{t:0,v:threshold}], W, H, PAD, lo, hi)`. Guard the empty-points case (lo/hi finite).
5. **Above-AeT accept copy (Task 2):** for the `above-aet` verdict the accept checkbox carries caution styling and override wording ("Force-accept despite HR being above AeT"); `below-aet` keeps neutral wording.

**UX framing (user feedback 2026-07-05):** render the two test buttons under an "Analysis" label as an analysis-tool picker (AeT/AnT are the first tools), not two loose buttons. The AeT test is already a single draggable region that auto-splits into halves (spec §2.1) — no change needed there. (Deeper workspace UX — drag cursor cues, hover value readout, full-screen layout — is a separate polish pass, not this milestone.)

## Global Constraints

- All milestone 1–4 Global Constraints apply (strict TS, domain purity grep — now also excludes `from 'uplot'`/`from 'zustand'`, TDD, commit style, `@/` alias, jsdom docblock, `TZ: 'UTC'`, no uPlot in vitest).
- Test results get ids from `crypto.randomUUID()` and `createdAt`/`now` from `new Date()` at the call site (app code, not domain).
- The active test window uses the reserved sector id `TEST_WINDOW_ID`; it is never persisted (persistence filters `kind === 'test-window'`), and never shown in the sector-chip row.

---

### Task 1: Store test-mode + test-window helpers

**Files:**
- Modify: `src/app/screens/activity/workspace-store.ts`, `src/app/screens/activity/workspace-store.test.ts`
- Create: `src/app/screens/activity/test-window.ts`, `src/app/screens/activity/test-window.test.ts`

**Interfaces:**
- `test-window.ts`:
  - `TEST_WINDOW_ID = '__test-window__'`
  - `type TestKind = 'aet' | 'ant'`
  - `suggestTestWindow(activity: Activity, kind: TestKind): TimeRange | null` — wraps `suggestWindow` with AeT (target 3600/min 2700) or AnT (target 1800/min 1800) params.
  - `testWindowSector(activityId: string, range: TimeRange): Sector` — a `kind: 'test-window'` sector with `TEST_WINDOW_ID`.
- store additions: state `activeTest: TestKind | null`; actions `startTest(kind, range)` (adds/replaces the test-window sector, sets `activeTest`, selects it), `cancelTest()` (removes the test-window sector, clears `activeTest`, deselects), and `testWindowRange(): TimeRange | null` selector helper. `removeSector`/`setSectors` unaffected. Non-test sectors are untouched by start/cancel.

- [ ] **Step 1: Write the failing tests**

`src/app/screens/activity/test-window.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { syntheticActivity, syntheticSeries } from '../../../domain/testing/synthetic'
import { suggestTestWindow, testWindowSector, TEST_WINDOW_ID } from './test-window'

describe('test-window helpers', () => {
  it('suggests an AeT window sized to the AeT protocol', () => {
    const a = syntheticActivity({
      durationS: 5400,
      channels: { heartRate: syntheticSeries({ durationS: 5400, value: () => 150 }) },
    })
    const w = suggestTestWindow(a, 'aet')
    expect(w).not.toBeNull()
    expect(w!.endS - w!.startS).toBe(3600)
  })

  it('suggests a shorter AnT window', () => {
    const a = syntheticActivity({
      durationS: 2400,
      channels: { heartRate: syntheticSeries({ durationS: 2400, value: () => 150 }) },
    })
    const w = suggestTestWindow(a, 'ant')
    expect(w!.endS - w!.startS).toBe(1800)
  })

  it('returns null when the activity is too short or lacks HR', () => {
    const noHr = syntheticActivity({ durationS: 5400 })
    expect(suggestTestWindow(noHr, 'aet')).toBeNull()
    const short = syntheticActivity({
      durationS: 600,
      channels: { heartRate: syntheticSeries({ durationS: 600, value: () => 150 }) },
    })
    expect(suggestTestWindow(short, 'aet')).toBeNull()
  })

  it('builds a test-window sector with the reserved id', () => {
    const s = testWindowSector('act1', { startS: 300, endS: 3900 })
    expect(s.id).toBe(TEST_WINDOW_ID)
    expect(s.kind).toBe('test-window')
    expect(s.activityId).toBe('act1')
    expect(s.range).toEqual({ startS: 300, endS: 3900 })
  })
})
```

Append to `src/app/screens/activity/workspace-store.test.ts`:

```ts
import { TEST_WINDOW_ID } from './test-window'

describe('workspace store test mode', () => {
  it('starts and cancels a test, managing the test-window sector', () => {
    const store = createWorkspaceStore()
    store.getState().init(activity(), [sector])
    store.getState().startTest('aet', { startS: 300, endS: 3900 })
    const s = store.getState()
    expect(s.activeTest).toBe('aet')
    expect(s.sectors.find((x) => x.id === TEST_WINDOW_ID)?.kind).toBe('test-window')
    expect(s.selectedSectorId).toBe(TEST_WINDOW_ID)
    // the user's own sector survives
    expect(s.sectors.some((x) => x.id === 's1')).toBe(true)

    store.getState().cancelTest()
    expect(store.getState().activeTest).toBeNull()
    expect(store.getState().sectors.some((x) => x.id === TEST_WINDOW_ID)).toBe(false)
    expect(store.getState().sectors.some((x) => x.id === 's1')).toBe(true)
  })

  it('replaces an existing test window when starting another test', () => {
    const store = createWorkspaceStore()
    store.getState().init(activity(), [])
    store.getState().startTest('aet', { startS: 0, endS: 3600 })
    store.getState().startTest('ant', { startS: 1800, endS: 3600 })
    const windows = store.getState().sectors.filter((x) => x.id === TEST_WINDOW_ID)
    expect(windows).toHaveLength(1)
    expect(store.getState().activeTest).toBe('ant')
  })
})
```

- [ ] **Step 2: Run to verify fail** — missing module + new store actions.

- [ ] **Step 3: Implement**

`src/app/screens/activity/test-window.ts`:

```ts
import { suggestWindow } from '../../../domain/analysis/window-suggestion'
import {
  AET_MIN_WINDOW_S,
  AET_TARGET_WINDOW_S,
  ANT_MIN_WINDOW_S,
} from '../../../domain/analysis/protocol-constants'
import type { Activity, Sector, TimeRange } from '../../../domain/model/types'

export const TEST_WINDOW_ID = '__test-window__'
export type TestKind = 'aet' | 'ant'

export function suggestTestWindow(activity: Activity, kind: TestKind): TimeRange | null {
  const opts =
    kind === 'aet'
      ? { targetLengthS: AET_TARGET_WINDOW_S, minLengthS: AET_MIN_WINDOW_S }
      : { targetLengthS: ANT_MIN_WINDOW_S, minLengthS: ANT_MIN_WINDOW_S }
  return suggestWindow(activity, opts)
}

export function testWindowSector(activityId: string, range: TimeRange): Sector {
  return { id: TEST_WINDOW_ID, activityId, range, label: 'test window', kind: 'test-window' }
}
```

In `workspace-store.ts`: add `activeTest: TestKind | null` to state and the interface, initialize to `null` (and reset to `null` in `init`), and add the actions. Import `TestKind`, `TEST_WINDOW_ID`, `testWindowSector` from `./test-window`, and `TimeRange` from the domain. Add:

```ts
    activeTest: null,
    // ...in init's set({...}) add: activeTest: null,
    startTest: (kind, range) =>
      set((s) => ({
        activeTest: kind,
        sectors: [
          ...s.sectors.filter((x) => x.id !== TEST_WINDOW_ID),
          testWindowSector(s.sectors[0]?.activityId ?? '', range),
        ],
        selectedSectorId: TEST_WINDOW_ID,
      })),
    cancelTest: () =>
      set((s) => ({
        activeTest: null,
        sectors: s.sectors.filter((x) => x.id !== TEST_WINDOW_ID),
        selectedSectorId: s.selectedSectorId === TEST_WINDOW_ID ? null : s.selectedSectorId,
      })),
```

> Note: `startTest`'s `activityId` fallback via `s.sectors[0]` is unreliable when there are no prior sectors. Change the action signature to `startTest(kind: TestKind, range: TimeRange, activityId: string)` and use that `activityId` in `testWindowSector`. Update the interface and the test calls accordingly (pass `'test-activity'` in the store test, since `syntheticActivity` defaults that id).

Add to the `WorkspaceState` interface:

```ts
  activeTest: TestKind | null
  startTest(kind: TestKind, range: TimeRange, activityId: string): void
  cancelTest(): void
```

(Adjust the two store-test `startTest` calls to pass `'test-activity'` as the third arg.)

- [ ] **Step 4: Verify pass; commit**

```bash
git add -A && git commit -m "feat(tests): workspace store test-mode and test-window helpers"
```

---

### Task 2: Test panel (AeT + AnT, live verdict)

**Files:**
- Create: `src/app/screens/activity/test-panel.tsx`, `src/app/screens/activity/test-panel.test.tsx`

**Interfaces:**
- Produces: `TestPanel({ activity, kind, window, driftChannel, onSave, onCancel })` — presentational. Computes the live evaluation on each render (`evaluateAetTest`/`evaluateAntTest`, guarded by try/catch for missing HR / no-data), renders:
  - AeT: decoupling %, verdict pill (above/at/below with color + UA guidance text), suggested AeT HR, window duration, warnings; an "accept this HR as AeT" checkbox shown only when the verdict is not `at-aet` but the window is valid; a Save button enabled only when `evaluation.valid`.
  - AnT: AnT HR (final 20 min), window avg HR, window duration, warnings; Save enabled when valid.
  - `onSave(result)` is called with a fully-built `TestResult` (the panel builds it via `buildAetResult`/`buildAntResult` using `crypto.randomUUID()` + `new Date()`); `onCancel()` closes.

- [ ] **Step 1: Write the failing test**

`src/app/screens/activity/test-panel.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TestResult } from '../../../domain/model/types'
import { syntheticActivity, syntheticSeries } from '../../../domain/testing/synthetic'
import { TestPanel } from './test-panel'

afterEach(cleanup)

function aetActivity() {
  return syntheticActivity({
    durationS: 5400,
    channels: {
      speed: syntheticSeries({ durationS: 5400, value: () => 3 }),
      heartRate: syntheticSeries({
        durationS: 5400,
        value: (t) => (t < 2400 ? 150 : 150 / 0.95),
      }),
    },
  })
}

describe('TestPanel AeT', () => {
  it('shows a live at-aet verdict and saves a result', async () => {
    const onSave = vi.fn<(r: TestResult) => void>()
    render(
      <TestPanel
        activity={aetActivity()}
        kind="aet"
        window={{ startS: 600, endS: 4200 }}
        driftChannel="speed"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('5.0%')).toBeInTheDocument()
    expect(screen.getByText(/at aet/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0]![0]
    expect(saved.kind).toBe('aet')
    if (saved.kind === 'aet') expect(saved.aetHr).toBe(154)
  })

  it('disables save for a too-short window', () => {
    render(
      <TestPanel
        activity={aetActivity()}
        kind="aet"
        window={{ startS: 600, endS: 1200 }}
        driftChannel="speed"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText(/too short/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })
})

describe('TestPanel AnT', () => {
  it('shows the AnT HR from the final 20 minutes and saves', async () => {
    const onSave = vi.fn<(r: TestResult) => void>()
    const a = syntheticActivity({
      durationS: 1800,
      channels: {
        heartRate: syntheticSeries({ durationS: 1800, value: (t) => (t < 600 ? 155 : 168) }),
        speed: syntheticSeries({ durationS: 1800, value: () => 3.4 }),
      },
    })
    render(
      <TestPanel
        activity={a}
        kind="ant"
        window={{ startS: 0, endS: 1800 }}
        driftChannel="speed"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText(/168/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    const saved = onSave.mock.calls[0]![0]
    expect(saved.kind).toBe('ant')
    if (saved.kind === 'ant') expect(saved.antHr).toBe(168)
  })
})
```

- [ ] **Step 2: Run to verify fail** — missing module.

- [ ] **Step 3: Implement**

`src/app/screens/activity/test-panel.tsx`:

```tsx
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
        buildAntResult({ id, activity, window, evaluation: evaluation as AntEvaluation, createdAt }),
      )
    }
  }

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

      {evaluation && kind === 'aet' && <AetBody e={evaluation as AetEvaluation} />}
      {evaluation && kind === 'ant' && <AntBody e={evaluation as AntEvaluation} />}

      {evaluation && (
        <ul className="space-y-1">
          {evaluation.warnings.map((w) => (
            <li key={w} className="text-xs text-caution">
              {WARNING_TEXT[w]}
            </li>
          ))}
        </ul>
      )}

      {evaluation && kind === 'aet' && (evaluation as AetEvaluation).verdict !== 'at-aet' && (evaluation as AetEvaluation).valid && (
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
          Accept the window average as my AeT HR anyway
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
        <Badge variant={e.verdict === 'at-aet' ? 'ok' : e.verdict === 'above-aet' ? 'danger' : 'caution'}>
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
        <span className="text-3xl font-semibold tabular-nums text-ch-hr">
          {formatBpm(e.antHr)}
        </span>
        <Badge variant="ok">AnT HR</Badge>
      </div>
      <p className="text-xs text-ink-muted">Average HR over the final 20 minutes of the effort.</p>
      <p className="text-xs">
        Window avg HR <span className="text-ch-hr">{formatBpm(e.windowAvgHr)}</span>
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Verify pass; commit**

```bash
git add -A && git commit -m "feat(tests): AeT/AnT test panel with live verdict and result building"
```

---

### Task 3: Wire test flows into the workspace

**Files:**
- Modify: `src/app/screens/activity/activity-screen.tsx`, `src/app/screens/activity/use-workspace-persistence.ts`, `src/app/screens/activity/chart-stack.tsx`

**Interfaces:**
- Workspace gains "AeT test" / "AnT test" buttons that call `store.startTest(...)` with a suggested window (disabled + tooltip when `suggestTestWindow` returns null); while `activeTest` is set, the right column shows the `TestPanel` (reading the live test-window range from the store) instead of the stats panel; Save persists the result via `repo.saveTestResult`, calls `onSaved()` to refresh library test-result state, and cancels the test; Cancel just cancels.
- Persistence hook skips `kind === 'test-window'` sectors in every diff branch (upserts and deletes).
- Chart-stack overlay draws `kind === 'test-window'` sectors distinctly (stronger fill + a midpoint split line for the AeT half boundary). Non-test sectors keep their existing style. (No new tests — canvas; validated in Task 5.)
- Sector-chip row filters out `TEST_WINDOW_ID`.

- [ ] **Step 1: Extend the failing screen test**

Append to `src/app/screens/activity/activity-screen.test.tsx`:

```tsx
it('runs and saves an AeT test that then appears as a badge source', async () => {
  const repo = new InMemoryLibraryRepository()
  const parser = new GarminFitFileParser()
  // user-run fixture is a valid ~60min run with HR + speed
  const [outcome] = await parser.parse(
    fixtureBytes('user-run-2026-07-05.fit'),
    'user-run-2026-07-05.fit',
  )
  if (!outcome!.ok) throw new Error('parse failed')
  await repo.saveActivity(outcome!.activity, outcome!.rawBytes)
  render(
    <MemoryRouter initialEntries={[`/activity/${outcome!.activity.id}`]}>
      <ContainerProvider container={{ repo, parser, persistent: true }}>
        <Routes>
          <Route path="/activity/:id" element={<ActivityScreen />} />
        </Routes>
      </ContainerProvider>
    </MemoryRouter>,
  )
  await userEvent.click(await screen.findByRole('button', { name: /aet test/i }))
  const save = await screen.findByRole('button', { name: /save result/i })
  await userEvent.click(save)
  await waitFor(async () => expect(await repo.listTestResults()).toHaveLength(1))
})
```

- [ ] **Step 2: Run to verify fail** — no AeT test button yet.

- [ ] **Step 3: Implement the wiring**

In `use-workspace-persistence.ts`, filter test-window sectors: change the flush to operate on `sectors.filter((s) => s.kind !== 'test-window')` (both the upsert loop source and the `now` map), so the transient window is never saved or diffed.

In `chart-stack.tsx` overlay, inside the `for (const s of sectors)` loop, branch on `s.kind === 'test-window'`: use fill `rgba(61,214,140,0.14)` and stroke `rgba(61,214,140,0.6)`, and when the kind is test-window draw a 1px vertical line at the midpoint `xpos((s.range.startS + s.range.endS) / 2)` from `top` to `top + h` in `rgba(230,235,240,0.35)`. Keep the existing style for normal sectors.

In `activity-screen.tsx` `Workspace`, add:
- `import { suggestTestWindow, TEST_WINDOW_ID, type TestKind } from './test-window'`, `import { TestPanel } from './test-panel'`, and accept a new prop `onSaved: () => void` threaded from `ActivityScreen` (which passes a callback that re-reads nothing locally — the library reads results on its own mount; for immediate feedback the workspace can also toast). Simplest: after save, `toast.success('Saved <kind> test')` via sonner and `store.cancelTest()`.
- read `activeTest = useZustand(store, (s) => s.activeTest)` and derive `testWindow = useZustand(store, (s) => s.sectors.find((x) => x.id === TEST_WINDOW_ID)?.range ?? null)`.
- a test-button row:

```tsx
const beginTest = (kind: TestKind) => {
  const w = suggestTestWindow(activity, kind)
  if (w) store.getState().startTest(kind, w, activity.id)
}
```

Render two buttons (each disabled when `suggestTestWindow(activity, kind)` is null — compute once via `useMemo`) with `onClick={() => beginTest(kind)}`.

- filter the sector-chip row: `sectors.filter((s) => s.id !== TEST_WINDOW_ID)`.
- right column: when `activeTest && testWindow`, render `<TestPanel activity={activity} kind={activeTest} window={testWindow} driftChannel={driftChannel} onSave={handleSaveResult} onCancel={() => store.getState().cancelTest()} />`; otherwise the existing `StatsPanel`.
- `handleSaveResult`:

```tsx
const handleSaveResult = (result: TestResult) => {
  void repo.saveTestResult(result)
  toast.success(`Saved ${result.kind.toUpperCase()} test`)
  store.getState().cancelTest()
}
```

(Import `toast` from sonner and `TestResult` from domain types.)

- [ ] **Step 4: Full gate; commit**

Run: `npm test && npm run lint && npm run build`
Expected: all green.

```bash
git add -A && git commit -m "feat(tests): wire AeT/AnT test flows into the workspace, persist results, style the test window"
```

---

### Task 4: Trends screen (SVG history charts)

**Files:**
- Create: `src/app/screens/trends/trends-geometry.ts`, `src/app/screens/trends/trends-geometry.test.ts`, `src/app/screens/trends/trend-chart.tsx`, `src/app/screens/trends/trends-screen.tsx`, `src/app/screens/trends/trends-screen.test.tsx`
- Modify: `src/App.tsx` (route + header nav link)

**Interfaces:**
- `trends-geometry.ts`:
  - `interface Point { t: number; v: number }`
  - `interface Scaled { x: number; y: number }`
  - `scalePoints(points: Point[], width: number, height: number, pad: number, yMin?: number, yMax?: number): Scaled[]` — maps time (x, ascending) and value (y, inverted so higher value is higher on screen) into the padded box; single-point series centers on x; a flat series centers on y.
  - `polyline(scaled: Scaled[]): string` — `"x,y x,y …"` for an SVG `points` attr.
- `trend-chart.tsx`: `TrendChart({ title, unit, points, yMin, yMax, threshold })` — a small SVG with dots + connecting line, optional dashed threshold line (for the 10% ADS gap), empty state when `points.length === 0`.
- `trends-screen.tsx`: `TrendsScreen()` — reads `useTestResults()`, derives four series (AeT HR, AnT HR, AeT decoupling %, ADS gap % via pairing latest-per-day is out of scope; just plot each AeT/AnT result by `testDate`, and ADS gap computed per AeT result against the most recent prior AnT — keep simple: plot AeT HR from aet results, AnT HR from ant results, decoupling from aet results, and ADS gap as a single derived series from `assessAds` over growing prefixes is overkill → instead show the ADS gap only when both exist, as the current `assessAds` value, rendered as a one-point marker). Renders a small-multiples grid.

- [ ] **Step 1: Write the failing tests**

`src/app/screens/trends/trends-geometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { polyline, scalePoints } from './trends-geometry'

describe('scalePoints', () => {
  it('maps ascending points into the padded box, y inverted', () => {
    const s = scalePoints(
      [
        { t: 0, v: 0 },
        { t: 10, v: 100 },
      ],
      120,
      100,
      10,
    )
    expect(s[0]).toEqual({ x: 10, y: 90 }) // min value at bottom
    expect(s[1]).toEqual({ x: 110, y: 10 }) // max value at top
  })

  it('centers a single point', () => {
    const s = scalePoints([{ t: 5, v: 42 }], 120, 100, 10)
    expect(s[0]!.x).toBe(60)
    expect(s[0]!.y).toBe(50)
  })

  it('centers a flat series vertically', () => {
    const s = scalePoints(
      [
        { t: 0, v: 50 },
        { t: 10, v: 50 },
      ],
      120,
      100,
      10,
    )
    expect(s[0]!.y).toBe(50)
    expect(s[1]!.y).toBe(50)
  })

  it('honors an explicit y range', () => {
    const s = scalePoints([{ t: 0, v: 5 }, { t: 10, v: 5 }], 120, 100, 10, 0, 10)
    expect(s[0]!.y).toBe(50) // v=5 halfway in [0,10]
  })
})

describe('polyline', () => {
  it('joins scaled points', () => {
    expect(polyline([{ x: 1, y: 2 }, { x: 3, y: 4 }])).toBe('1,2 3,4')
  })
})
```

`src/app/screens/trends/trends-screen.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { AetTestResult } from '../../../domain/model/types'
import { InMemoryLibraryRepository } from '../../../adapters/storage/in-memory-library-repository'
import { GarminFitFileParser } from '../../../adapters/fit/fit-file-parser'
import { ContainerProvider } from '../../container-context'
import { TrendsScreen } from './trends-screen'

afterEach(cleanup)

function render_(repo: InMemoryLibraryRepository) {
  render(
    <MemoryRouter>
      <ContainerProvider container={{ repo, parser: new GarminFitFileParser(), persistent: true }}>
        <TrendsScreen />
      </ContainerProvider>
    </MemoryRouter>,
  )
}

describe('TrendsScreen', () => {
  it('shows an empty state with no test history', async () => {
    render_(new InMemoryLibraryRepository())
    expect(await screen.findByText(/no test history yet/i)).toBeInTheDocument()
  })

  it('renders the AeT HR trend after a result exists', async () => {
    const repo = new InMemoryLibraryRepository()
    const aet: AetTestResult = {
      kind: 'aet',
      id: 'a1',
      activityId: 'act1',
      testDate: new Date('2026-06-01T08:00:00Z'),
      createdAt: new Date('2026-06-01T08:00:00Z'),
      window: { startS: 0, endS: 3600 },
      driftChannel: 'speed',
      decouplingPct: 4.2,
      windowAvgHr: 148,
      verdict: 'at-aet',
      aetHr: 148,
    }
    await repo.saveTestResult(aet)
    render_(repo)
    expect(await screen.findByText(/aet hr/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify fail** — missing modules.

- [ ] **Step 3: Implement**

`src/app/screens/trends/trends-geometry.ts`:

```ts
export interface Point {
  t: number
  v: number
}
export interface Scaled {
  x: number
  y: number
}

export function scalePoints(
  points: Point[],
  width: number,
  height: number,
  pad: number,
  yMin?: number,
  yMax?: number,
): Scaled[] {
  if (points.length === 0) return []
  const ts = points.map((p) => p.t)
  const vs = points.map((p) => p.v)
  const tMin = Math.min(...ts)
  const tMax = Math.max(...ts)
  const vLo = yMin ?? Math.min(...vs)
  const vHi = yMax ?? Math.max(...vs)
  const innerW = width - 2 * pad
  const innerH = height - 2 * pad
  const xFor = (t: number) => (tMax === tMin ? pad + innerW / 2 : pad + ((t - tMin) / (tMax - tMin)) * innerW)
  const yFor = (v: number) =>
    vHi === vLo ? pad + innerH / 2 : pad + (1 - (v - vLo) / (vHi - vLo)) * innerH
  return points.map((p) => ({ x: xFor(p.t), y: yFor(p.v) }))
}

export function polyline(scaled: Scaled[]): string {
  return scaled.map((s) => `${s.x},${s.y}`).join(' ')
}
```

`src/app/screens/trends/trend-chart.tsx`:

```tsx
import { polyline, scalePoints, type Point } from './trends-geometry'

const W = 300
const H = 140
const PAD = 24

export function TrendChart({
  title,
  unit,
  points,
  colorHex,
  yMin,
  yMax,
  threshold,
}: {
  title: string
  unit: string
  points: Point[]
  colorHex: string
  yMin?: number
  yMax?: number
  threshold?: number
}) {
  const scaled = scalePoints(points, W, H, PAD, yMin, yMax)
  const thresholdY =
    threshold !== undefined ? scalePoints([{ t: 0, v: threshold }], W, H, PAD, yMin, yMax)[0]?.y : undefined

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <h3 className="mb-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
        {title} <span className="text-ink-muted/70">{unit}</span>
      </h3>
      {points.length === 0 ? (
        <p className="flex h-[140px] items-center justify-center text-xs text-ink-muted">
          No data yet
        </p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title} trend`}>
          {thresholdY !== undefined && (
            <line
              x1={PAD}
              x2={W - PAD}
              y1={thresholdY}
              y2={thresholdY}
              stroke="#f0525f"
              strokeDasharray="3 3"
              strokeWidth={1}
              opacity={0.6}
            />
          )}
          {scaled.length > 1 && (
            <polyline points={polyline(scaled)} fill="none" stroke={colorHex} strokeWidth={1.5} />
          )}
          {scaled.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={3} fill={colorHex} />
          ))}
        </svg>
      )}
    </div>
  )
}
```

`src/app/screens/trends/trends-screen.tsx`:

```tsx
import { useMemo } from 'react'
import { ADS_GAP_THRESHOLD_PCT } from '../../../domain/analysis/protocol-constants'
import type { AetTestResult, AntTestResult } from '../../../domain/model/types'
import { useTestResults } from '../../hooks'
import { TrendChart } from './trend-chart'
import type { Point } from './trends-geometry'

export function TrendsScreen() {
  const { results } = useTestResults()

  const { aetHr, antHr, decoupling, gap } = useMemo(() => {
    const aets = results
      .filter((r): r is AetTestResult => r.kind === 'aet')
      .sort((a, b) => a.testDate.getTime() - b.testDate.getTime())
    const ants = results
      .filter((r): r is AntTestResult => r.kind === 'ant')
      .sort((a, b) => a.testDate.getTime() - b.testDate.getTime())
    const aetHr: Point[] = aets
      .filter((r) => r.aetHr !== null)
      .map((r) => ({ t: r.testDate.getTime(), v: r.aetHr! }))
    const antHr: Point[] = ants.map((r) => ({ t: r.testDate.getTime(), v: r.antHr }))
    const decoupling: Point[] = aets.map((r) => ({ t: r.testDate.getTime(), v: r.decouplingPct }))
    // ADS gap over time: for each AnT result, pair with the most recent AeT (with an HR) on or before it
    const gap: Point[] = ants
      .map((ant) => {
        const aet = [...aets]
          .reverse()
          .find((a) => a.aetHr !== null && a.testDate.getTime() <= ant.testDate.getTime())
        if (!aet) return null
        return { t: ant.testDate.getTime(), v: ((ant.antHr - aet.aetHr!) / ant.antHr) * 100 }
      })
      .filter((p): p is Point => p !== null)
    return { aetHr, antHr, decoupling, gap }
  }, [results])

  const empty = results.length === 0
  if (empty) {
    return (
      <p className="text-sm text-ink-muted">
        No test history yet. Run an AeT or AnT test from a run to start tracking trends.
      </p>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TrendChart title="AeT HR" unit="bpm" points={aetHr} colorHex="#ff6b6b" />
      <TrendChart title="AnT HR" unit="bpm" points={antHr} colorHex="#ff6b6b" />
      <TrendChart title="AeT decoupling" unit="%" points={decoupling} colorHex="#4cc9f0" />
      <TrendChart
        title="ADS gap"
        unit="%"
        points={gap}
        colorHex="#a78bfa"
        yMin={0}
        threshold={ADS_GAP_THRESHOLD_PCT}
      />
    </div>
  )
}
```

In `src/App.tsx`: add a header nav link to `/trends` and the route. The header currently has the brand block; add after it (still inside `<header>`):

```tsx
<nav className="ml-auto flex gap-4 font-mono text-xs uppercase tracking-widest text-ink-muted">
  <Link to="/" className="hover:text-ink">Library</Link>
  <Link to="/trends" className="hover:text-ink">Trends</Link>
</nav>
```

(Import `Link` from react-router-dom.) Add the route `<Route path="/trends" element={<TrendsScreen />} />` and import `TrendsScreen`. Note: `AppShell` currently takes only `children`; the nav lives in `AppShell`'s header, so add the nav markup there. Because `AppShell` is also rendered in `App.test.tsx` inside `MemoryRouter`, the `Link`s are fine there.

- [ ] **Step 4: Full gate; commit**

Run: `npm test && npm run lint && npm run build`
Expected: all green. Purity grep clean.

```bash
git add -A && git commit -m "feat(trends): SVG trend charts for AeT/AnT HR, decoupling, and ADS gap over time"
```

---

### Task 5: Visual verification

- [ ] **Step 1:** `npm run dev`; via playwright-cli: import `user-run-2026-07-05.fit`, open its workspace, click "AeT test" → confirm a green test-window band with a midpoint split line appears across panes and the panel shows a live decoupling % + verdict; drag the window and watch the % change; click "Save result" → toast; navigate to Trends and confirm the AeT HR / decoupling charts show a point; back on the Library, confirm the run row shows an "AeT" badge and the ADS readout advanced past "Run an AeT test to begin". Screenshot the test flow and Trends.
- [ ] **Step 2:** Fix defects; re-verify; commit.

## Definition of done (milestone 5)

- Full gate green (test-window/store/test-panel/trends-geometry/trends-screen tests + all prior), purity grep clean.
- In-browser: AeT and AnT tests run with a live verdict, save, and drive the ADS readout, run badges, and Trends charts; the test window is draggable and never persists as a normal sector.
- `npm run build` and `npm run dev` both work.
