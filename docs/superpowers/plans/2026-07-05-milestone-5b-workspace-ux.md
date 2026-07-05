# Milestone 5b: Workspace UX Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the workspace discoverable and spacious per user feedback: dragging shows cursor cues (`ew-resize` on edges/trims, `grab`/`grabbing` on sector bodies) and visible grip handles; hovering shows every visible channel's value at the cursor time; and the workspace uses a near-full-screen layout with the analysis panel in a fixed right sidebar.

**Architecture:** Two new pure, unit-tested helpers — `cursorForTarget` (added to chart-geometry) and `channelValuesAt` (nearest-sample lookup). The chart-stack gains hover handling (cursor style + a `hoverT` store field) and grip handles in the overlay. A `HoverReadout` component subscribes to `hoverT` alone (Zustand selector isolation → only it re-renders on hover). Layout widens the workspace route without touching Library/Trends.

**Tech Stack:** nothing new.

## Addresses (user UX feedback 2026-07-05)

- #1/#2 discoverability → cursor cues + grip handles.
- #4 hover readout → `channelValuesAt` + `HoverReadout`.
- #5 full-screen → per-screen container widths (workspace wide, others unchanged).
- (#3 single AeT region and #6 analysis-tool selector already shipped in milestone 5.)

## Review amendments (apply during execution — supersede the task bodies below)

1. **HoverReadout value element (Task 4, blocker):** render the value in its own inner element so `getByText('150')` resolves — `{v.label} <span className="text-ink">{v.text}</span>` inside the colored chip span.
2. **Guard the chart-stack redraw subscription (Task 3, perf):** `store.subscribe(redrawAll)` currently fires on every `setHoverT`, redrawing all canvases per pixel of hover. Guard it like the persistence hook — track `sectors`/`exclusions`/`selectedSectorId` refs at effect scope and early-return in the subscriber when none changed, so hover-only updates skip the redraw.

## Global Constraints

- All prior Global Constraints apply (strict TS, domain purity grep, TDD, commit style, `@/` alias, jsdom docblock, `TZ: 'UTC'`, no uPlot in vitest).
- `hoverT` is transient UI state added to the workspace store; the persistence hook must NOT flush on hover-only changes (guard by referential equality of `sectors`/`exclusions`).

---

### Task 1: Pure helpers — cursor cue + channel value lookup

**Files:**
- Modify: `src/app/screens/activity/chart-geometry.ts`, `src/app/screens/activity/chart-geometry.test.ts`
- Create: `src/app/screens/activity/channel-values.ts`, `src/app/screens/activity/channel-values.test.ts`

**Interfaces:**
- `chart-geometry.ts` adds `cursorForTarget(target: DragTarget, dragging: boolean): string` — `ew-resize` for edge/trim targets; `grab` (or `grabbing` when dragging) for `move-sector`; `crosshair` for `create`.
- `channel-values.ts`:
  - `nearestIndex(t: Float64Array, target: number): number` — binary search for the index whose time is closest to `target` (−1 for an empty array).
  - `interface HoverValue { key: DisplayChannel; label: string; colorHex: string; text: string }`
  - `channelValuesAt(activity: Activity, tS: number): HoverValue[]` — for each present display channel, the nearest sample formatted via its channel meta (skips channels with no samples).

- [ ] **Step 1: Write the failing tests**

Append to `src/app/screens/activity/chart-geometry.test.ts`:

```ts
import { cursorForTarget } from './chart-geometry'

describe('cursorForTarget', () => {
  it('maps targets to cursor styles', () => {
    expect(cursorForTarget({ kind: 'resize-start', id: 's1' }, false)).toBe('ew-resize')
    expect(cursorForTarget({ kind: 'trim-warmup' }, false)).toBe('ew-resize')
    expect(cursorForTarget({ kind: 'move-sector', id: 's1' }, false)).toBe('grab')
    expect(cursorForTarget({ kind: 'move-sector', id: 's1' }, true)).toBe('grabbing')
    expect(cursorForTarget({ kind: 'create' }, false)).toBe('crosshair')
  })
})
```

`src/app/screens/activity/channel-values.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { makeSeries } from '../../../domain/model/series'
import { syntheticActivity, syntheticSeries } from '../../../domain/testing/synthetic'
import { channelValuesAt, nearestIndex } from './channel-values'

describe('nearestIndex', () => {
  const t = makeSeries([0, 10, 20, 30], [0, 0, 0, 0]).t
  it('finds the closest index', () => {
    expect(nearestIndex(t, 0)).toBe(0)
    expect(nearestIndex(t, 12)).toBe(1)
    expect(nearestIndex(t, 16)).toBe(2)
    expect(nearestIndex(t, 100)).toBe(3)
    expect(nearestIndex(t, -5)).toBe(0)
  })
  it('handles an empty array', () => {
    expect(nearestIndex(makeSeries([], []).t, 5)).toBe(-1)
  })
})

describe('channelValuesAt', () => {
  it('reads the nearest value per present channel', () => {
    const a = syntheticActivity({
      durationS: 100,
      channels: {
        heartRate: syntheticSeries({ durationS: 100, value: (t) => 150 + t / 10 }),
        speed: syntheticSeries({ durationS: 100, value: () => 3 }),
      },
    })
    const vals = channelValuesAt(a, 50)
    const hr = vals.find((v) => v.key === 'heartRate')!
    expect(hr.text).toBe('155') // 150 + 50/10
    expect(vals.find((v) => v.key === 'pace')!.text).toBe('5:33')
    expect(vals.some((v) => v.key === 'power')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify fail** — missing exports/module.

- [ ] **Step 3: Implement**

Append to `chart-geometry.ts`:

```ts
export function cursorForTarget(target: DragTarget, dragging: boolean): string {
  switch (target.kind) {
    case 'move-sector':
      return dragging ? 'grabbing' : 'grab'
    case 'create':
      return 'crosshair'
    default:
      return 'ew-resize'
  }
}
```

`src/app/screens/activity/channel-values.ts`:

```ts
import type { Activity } from '../../../domain/model/types'
import { CHANNELS, type DisplayChannel } from '../../channels'

export function nearestIndex(t: Float64Array, target: number): number {
  const n = t.length
  if (n === 0) return -1
  let lo = 0
  let hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (t[mid]! < target) lo = mid + 1
    else hi = mid
  }
  // lo is the first index with t[lo] >= target; compare with lo-1 for the nearer one
  if (lo > 0 && Math.abs(t[lo - 1]! - target) <= Math.abs(t[lo]! - target)) return lo - 1
  return lo
}

export interface HoverValue {
  key: DisplayChannel
  label: string
  colorHex: string
  text: string
}

export function channelValuesAt(activity: Activity, tS: number): HoverValue[] {
  const out: HoverValue[] = []
  for (const c of CHANNELS) {
    const series = activity.channels[c.sourceChannel]
    if (!series || series.t.length === 0) continue
    const i = nearestIndex(series.t, tS)
    if (i < 0) continue
    out.push({ key: c.key, label: c.label, colorHex: c.colorHex, text: c.format(series.v[i]!) })
  }
  return out
}
```

- [ ] **Step 4: Verify pass; commit**

```bash
git add -A && git commit -m "feat(workspace): pure cursor-cue and nearest-sample channel-value helpers"
```

---

### Task 2: Store hoverT + persistence guard

**Files:**
- Modify: `src/app/screens/activity/workspace-store.ts`, `src/app/screens/activity/workspace-store.test.ts`, `src/app/screens/activity/use-workspace-persistence.ts`

**Interfaces:**
- store adds `hoverT: number | null` (init `null`, reset to `null` in `init`) and `setHoverT(t: number | null)`.
- persistence hook: its subscribe listener must early-return when neither `sectors` nor `exclusions` changed by reference since the last fire (so `setHoverT` never schedules a repo flush).

- [ ] **Step 1: Write the failing test**

Append to `workspace-store.test.ts` (inside the existing `describe('workspace store', ...)` or a new one):

```ts
describe('workspace store hover', () => {
  it('sets and clears the hover time without touching sectors', () => {
    const store = createWorkspaceStore()
    store.getState().init(activity(), [sector])
    const sectorsRef = store.getState().sectors
    store.getState().setHoverT(42)
    expect(store.getState().hoverT).toBe(42)
    expect(store.getState().sectors).toBe(sectorsRef) // unchanged reference
    store.getState().setHoverT(null)
    expect(store.getState().hoverT).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify fail** — `hoverT`/`setHoverT` missing.

- [ ] **Step 3: Implement**

In `workspace-store.ts`: add `hoverT: number | null` and `setHoverT(t: number | null): void` to `WorkspaceState`; initialize `hoverT: null` in the store body and in `init`'s `set({...})`; add the action `setHoverT: (hoverT) => set({ hoverT })`.

In `use-workspace-persistence.ts`, guard the subscribe listener. Replace the subscribe block with:

```ts
    let lastSectors = store.getState().sectors
    let lastExclusions = store.getState().exclusions
    const unsub = store.subscribe(() => {
      const s = store.getState()
      if (s.sectors === lastSectors && s.exclusions === lastExclusions) return // hover-only change
      lastSectors = s.sectors
      lastExclusions = s.exclusions
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, 500)
    })
```

(The `prevSectors`/`prevExclusions` refs used inside `flush` still seed as before.)

- [ ] **Step 4: Verify pass; commit**

```bash
git add -A && git commit -m "feat(workspace): transient hoverT store state with persistence guard"
```

---

### Task 3: Chart-stack hover, cursor cues, grip handles

**Files:**
- Modify: `src/app/screens/activity/chart-stack.tsx`

**Interfaces:** (no unit test — canvas; validated in Task 5)
- On hover (pointermove with no active drag): set `u.over.style.cursor = cursorForTarget(hitTest(...), false)` and `store.getState().setHoverT(time)`.
- On `pointerleave`: `setHoverT(null)` and reset cursor to `default`.
- During a drag: set the cursor via `cursorForTarget(drag.target, true)` on pointerdown.
- Overlay draws grip handles: at each non-excluded sector's start/end edges and at both trim boundaries, draw a short centered vertical "grip" (a 3px-wide rounded bar spanning the middle ~40% of the pane height) in the band's stroke color, so edges read as draggable.

- [ ] **Step 1: Implement**

In `chart-stack.tsx`:
- import `cursorForTarget` alongside the other geometry imports.
- In `pointerdown`, after resolving `target`, set `u.over.style.cursor = cursorForTarget(target, true)`.
- In `pointermove`, at the top when `dragRef.current` is null, add hover handling:

```ts
      u.over.addEventListener('pointermove', (e) => {
        const drag = dragRef.current
        if (!drag) {
          const t = timeAt(e)
          const { sectors, exclusions } = store.getState()
          const tolS = pxToleranceS(EDGE_TOL_PX, domainMax, u.over.clientWidth)
          u.over.style.cursor = cursorForTarget(hitTest(t, sectors, exclusions, tolS), false)
          store.getState().setHoverT(t)
          return
        }
        if (drag.target.kind === 'create') return
        // ...existing applyDrag logic unchanged...
      })
```

- add a `pointerleave` listener: `u.over.addEventListener('pointerleave', () => { store.getState().setHoverT(null); u.over.style.cursor = 'default' })`.
- in the overlay, after drawing each band, draw grip handles. Add a helper inside `overlay`:

```ts
      const grip = (xEdge: number, color: string) => {
        const gh = h * 0.4
        const gy = top + (h - gh) / 2
        ctx.fillStyle = color
        ctx.fillRect(xEdge - 1.5, gy, 3, gh)
      }
```

Call `grip(xpos(exclusions.warmupEndS), 'rgba(240,82,95,0.8)')` and `grip(xpos(exclusions.cooldownStartS), 'rgba(240,82,95,0.8)')` for trims, and for each sector `grip(x0, edgeColor)` and `grip(x1, edgeColor)` where `edgeColor` is the band's stroke color (green for test-window, blue otherwise).

- [ ] **Step 2: Lint + build** (`npm run lint && npm run build` — exit 0).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(workspace): hover cursor cues, hover-time tracking, and draggable grip handles"
```

---

### Task 4: HoverReadout + full-screen layout

**Files:**
- Create: `src/app/screens/activity/hover-readout.tsx`, `src/app/screens/activity/hover-readout.test.tsx`
- Modify: `src/App.tsx` (per-screen widths), `src/app/screens/activity/activity-screen.tsx` (wide container + mount HoverReadout), `src/app/screens/library/library-screen.tsx` and `src/app/screens/trends/trends-screen.tsx` (self-wrap in max-w-5xl)

**Interfaces:**
- `HoverReadout({ activity, store })` — subscribes to `hoverT` via `useZustand(store, s => s.hoverT)`; when null shows a muted "hover a chart for values" hint; otherwise shows the elapsed time and each channel's value (colored chips) via `channelValuesAt`. Only this component re-renders on hover.
- Layout: `AppShell` main becomes full-width padding only; Library and Trends wrap their content in `mx-auto max-w-5xl`; the workspace wraps in `mx-auto max-w-[1600px]` and uses a `lg:grid-cols-[1fr_360px]` split with taller charts.

- [ ] **Step 1: Write the failing test**

`src/app/screens/activity/hover-readout.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { syntheticActivity, syntheticSeries } from '../../../domain/testing/synthetic'
import { createWorkspaceStore } from './workspace-store'
import { HoverReadout } from './hover-readout'

afterEach(cleanup)

function setup() {
  const a = syntheticActivity({
    durationS: 100,
    channels: { heartRate: syntheticSeries({ durationS: 100, value: () => 150 }) },
  })
  const store = createWorkspaceStore()
  store.getState().init(a, [])
  return { a, store }
}

describe('HoverReadout', () => {
  it('shows a hint when not hovering', () => {
    const { a, store } = setup()
    render(<HoverReadout activity={a} store={store} />)
    expect(screen.getByText(/hover a chart/i)).toBeInTheDocument()
  })

  it('shows channel values at the hover time', () => {
    const { a, store } = setup()
    store.getState().setHoverT(50)
    render(<HoverReadout activity={a} store={store} />)
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText(/0:50/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify fail** — missing module.

- [ ] **Step 3: Implement**

`src/app/screens/activity/hover-readout.tsx`:

```tsx
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
            <span key={v.key} className="tabular-nums" style={{ color: v.colorHex }}>
              {v.label} {v.text}
            </span>
          ))}
        </>
      )}
    </div>
  )
}
```

In `activity-screen.tsx` `Workspace`: mount `<HoverReadout activity={activity} store={store} />` just above the chart/analysis grid, and change the grid to `lg:grid-cols-[1fr_360px]`. Import `HoverReadout`. (The outer container width is set by the route wrapper below.)

In `App.tsx`: change `<main className="mx-auto max-w-5xl px-6 py-8">` to `<main className="px-6 py-8">`, and wrap each route's element in its own width container — simplest: give `LibraryScreen` and `TrendsScreen` a top-level `mx-auto max-w-5xl` wrapper, and `ActivityScreen`'s returned tree a `mx-auto max-w-[1600px]` wrapper. Do this by editing each screen's outermost element className (Library's `space-y-8` → `mx-auto max-w-5xl space-y-8`; Trends' outputs → wrap; the workspace's `space-y-4` → `mx-auto max-w-[1600px] space-y-4`, and the not-found/loading returns keep a `max-w-5xl` wrapper). The session banner in `App` stays full-width above routes.

Also bump chart height in `chart-stack.tsx` from 140 to 180 (both the `new uPlot` `height` and the placeholder `h-[140px]` → `h-[180px]`, and the resize `setSize` height) for the roomier layout.

- [ ] **Step 4: Full gate; commit**

Run: `npm test && npm run lint && npm run build`
Expected: all green. Purity grep clean.

```bash
git add -A && git commit -m "feat(workspace): channel hover readout and near-full-screen workspace layout"
```

---

### Task 5: Visual verification

- [ ] **Step 1:** `npm run dev`; via playwright-cli open the user run's workspace. Confirm: hovering a chart updates the readout bar with each channel's value at the cursor time; the cursor becomes `ew-resize` near a sector edge / trim and `grab` inside a sector; grip handles are visible at edges; the workspace fills much more of the screen with the analysis panel on the right. Screenshot the hover readout and the wide layout.
- [ ] **Step 2:** Fix defects; re-verify; commit.

## Definition of done (milestone 5b)

- Full gate green (cursor/channel-value/hover-store/hover-readout tests + all prior), purity grep clean.
- In-browser: hover readout shows per-channel values; cursor cues + grip handles make dragging discoverable; workspace is near-full-screen with a right analysis sidebar; Library/Trends unchanged in width.
