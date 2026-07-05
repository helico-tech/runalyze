# Milestone 4: Analysis Workspace (charts, sectors, trims, stats, notes) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Opening a run shows stacked, crosshair-synced uPlot charts (one per visible channel); you drag on the charts to create/move/resize sectors, drag end handles to trim warmup/cooldown, read whole-run and per-sector stats (including first/second-half splits and decoupling), and write autosaved notes — all persisted.

**Architecture:** All chart interaction resolves to **pure geometry functions** (px↔time, hit-testing, drag application) that are heavily unit-tested in node; the imperative uPlot layer is a thin, canvas-guarded React wrapper validated in-browser. Workspace UI state lives in a Zustand store; sectors, exclusions, and notes persist through the milestone-2 `LibraryRepository`. Domain purity holds — charts/stores never leak into `src/domain/`.

**Tech Stack:** uplot 1.6.x (canvas charts, self-typed), zustand 5 (workspace state).

## Spike facts (verified 2026-07-05, uplot 1.6.32)

- `import uPlot, { type AlignedData, type Options } from 'uplot'` typechecks under strict + `moduleResolution: bundler` with NO `@types/uplot` (uPlot ships `dist/uPlot.d.ts`, resolved automatically). CSS at `uplot/dist/uPlot.min.css`.
- `AlignedData` accepts `TypedArray[]` directly, so a single-series pane passes `[channel.t, channel.v]` with **no copy and no cross-channel alignment** (each pane is its own chart with its own x-array).
- Coordinate methods on the instance: `valToPos(val, 'x', true)` → **canvas** pixels (for `ctx` drawing in the `draw` hook, consistent with `bbox.top`/`bbox.height`); `posToVal(cssOffset, 'x')` → time from a **CSS**-pixel mouse `offsetX` on `u.over`. Do not mix the two pixel spaces.
- Overlay bands: a plugin `{ hooks: { draw: (u) => { ...u.ctx.fillRect(...) } } }`; force a repaint with `u.redraw()`.
- Crosshair sync across panes: `cursor: { sync: { key } }` on every chart + one shared `uPlot.sync(key)` (static). Panes share the x **domain** (elapsed seconds), so sync aligns by value even with different sample counts.
- `u.over` (`.u-over` div) is where mouse listeners attach; `u.destroy()` on unmount.

## Global Constraints

- All milestone 1–3 Global Constraints apply (strict TS, domain purity grep, TDD, commit style, `@/` alias, jsdom docblock for component tests, `TZ: 'UTC'`).
- **No uPlot construction in vitest.** Canvas `getContext('2d')` returns null under jsdom; the chart-stack guards on that and renders a placeholder, so workspace component tests exercise everything except the canvas. Charts are validated only in the Task 7 browser pass.
- Pure geometry (`src/app/screens/activity/chart-geometry.ts`) imports nothing from React/uPlot/DOM — it is plain math, unit-tested in node.
- Channel display metadata (colors as literal hex, labels, value formatters) lives once in `src/app/channels.ts`; hex values mirror the theme tokens in `src/index.css`.

---

### Task 1: Chart geometry (pure math)

**Files:**
- Create: `src/app/screens/activity/chart-geometry.ts`, `src/app/screens/activity/chart-geometry.test.ts`

**Interfaces:**
- Consumes: `TimeRange`, `Exclusions`, `Sector` (domain types); `rangeLengthS` (milestone 1).
- Produces:
  - `pxToleranceS(pxTol: number, domainS: number, plotWidthPx: number): number`
  - `type DragTarget = { kind: 'create' } | { kind: 'move-sector'; id: string } | { kind: 'resize-start'; id: string } | { kind: 'resize-end'; id: string } | { kind: 'trim-warmup' } | { kind: 'trim-cooldown' }`
  - `hitTest(timeS: number, sectors: Sector[], ex: Exclusions, tolS: number): DragTarget` — nearest edge (sector start/end, warmup, cooldown) within `tolS` wins; else inside-a-sector → move; else create. Ties resolve to the earliest-registered candidate.
  - `interface DragResult { sectors: Sector[]; exclusions: Exclusions }`
  - `applyDrag(target, sectors, ex, grabTimeS, currentTimeS, durationS, minWidthS): DragResult` — pure; clamps to `[0, durationS]`, enforces `minWidthS`, never lets warmup cross cooldown or a sector edge cross its partner. `move-sector` shifts by `currentTimeS − grabTimeS` preserving width.
  - `createSector(id, aS, bS, durationS, minWidthS): Sector | null` — from a dragged range; `null` if `|b − a| < minWidthS`; result clamped, `kind: 'sector'`, `label: ''`.

- [ ] **Step 1: Write the failing tests**

`src/app/screens/activity/chart-geometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Exclusions, Sector } from '../../../domain/model/types'
import { applyDrag, createSector, hitTest, pxToleranceS } from './chart-geometry'

const ex: Exclusions = { warmupEndS: 300, cooldownStartS: 3300 }
const sectors: Sector[] = [
  { id: 's1', activityId: 'a', range: { startS: 600, endS: 1200 }, label: '', kind: 'sector' },
  { id: 's2', activityId: 'a', range: { startS: 1800, endS: 2400 }, label: '', kind: 'sector' },
]

describe('pxToleranceS', () => {
  it('converts a pixel tolerance to time units', () => {
    // 6px tolerance over a 3600s domain shown across 900px → 24s
    expect(pxToleranceS(6, 3600, 900)).toBe(24)
  })
  it('is zero-safe on zero width', () => {
    expect(pxToleranceS(6, 3600, 0)).toBe(Infinity)
  })
})

describe('hitTest', () => {
  const tol = 20
  it('grabs the nearest sector edge within tolerance', () => {
    expect(hitTest(610, sectors, ex, tol)).toEqual({ kind: 'resize-start', id: 's1' })
    expect(hitTest(1195, sectors, ex, tol)).toEqual({ kind: 'resize-end', id: 's1' })
  })
  it('grabs trim handles', () => {
    expect(hitTest(305, sectors, ex, tol)).toEqual({ kind: 'trim-warmup' })
    expect(hitTest(3290, sectors, ex, tol)).toEqual({ kind: 'trim-cooldown' })
  })
  it('moves when inside a sector body away from edges', () => {
    expect(hitTest(900, sectors, ex, tol)).toEqual({ kind: 'move-sector', id: 's1' })
  })
  it('creates in empty space', () => {
    expect(hitTest(1500, sectors, ex, tol)).toEqual({ kind: 'create' })
  })
  it('prefers the nearest edge when two are close', () => {
    // 1210 is 10s from s1.end (1200) and 590s from s2.start → resize-end s1
    expect(hitTest(1210, sectors, ex, tol)).toEqual({ kind: 'resize-end', id: 's1' })
  })
})

describe('applyDrag', () => {
  it('resizes a sector end, clamped to min width', () => {
    const r = applyDrag({ kind: 'resize-end', id: 's1' }, sectors, ex, 1200, 610, 3600, 60)
    expect(r.sectors[0]!.range).toEqual({ startS: 600, endS: 660 }) // clamped to start+minWidth
  })
  it('resizes a sector start, clamped to min width', () => {
    const r = applyDrag({ kind: 'resize-start', id: 's1' }, sectors, ex, 600, 1190, 3600, 60)
    expect(r.sectors[0]!.range).toEqual({ startS: 1140, endS: 1200 }) // clamped to end-minWidth
  })
  it('moves a sector preserving width, clamped to bounds', () => {
    const r = applyDrag({ kind: 'move-sector', id: 's2' }, sectors, ex, 2100, 3600, 3600, 60)
    // width 600, delta would push end past 3600 → clamp end to 3600
    expect(r.sectors[1]!.range).toEqual({ startS: 3000, endS: 3600 })
  })
  it('drags the warmup trim without crossing cooldown', () => {
    const r = applyDrag({ kind: 'trim-warmup' }, sectors, ex, 300, 5000, 3600, 60)
    expect(r.exclusions).toEqual({ warmupEndS: 3240, cooldownStartS: 3300 }) // cooldown-minWidth
  })
  it('drags the cooldown trim without crossing warmup', () => {
    const r = applyDrag({ kind: 'trim-cooldown' }, sectors, ex, 3300, 100, 3600, 60)
    expect(r.exclusions).toEqual({ warmupEndS: 300, cooldownStartS: 360 }) // warmup+minWidth
  })
  it('leaves other sectors untouched', () => {
    const r = applyDrag({ kind: 'move-sector', id: 's1' }, sectors, ex, 900, 1000, 3600, 60)
    expect(r.sectors[1]).toEqual(sectors[1])
  })
})

describe('createSector', () => {
  it('builds a clamped sector from a dragged range', () => {
    const s = createSector('n1', 2600, 3000, 3600, 60)
    expect(s).toEqual({
      id: 'n1',
      activityId: '',
      range: { startS: 2600, endS: 3000 },
      label: '',
      kind: 'sector',
    })
  })
  it('normalizes reversed drags', () => {
    expect(createSector('n1', 3000, 2600, 3600, 60)!.range).toEqual({ startS: 2600, endS: 3000 })
  })
  it('rejects a too-small drag', () => {
    expect(createSector('n1', 2600, 2610, 3600, 60)).toBeNull()
  })
  it('clamps to the activity bounds', () => {
    expect(createSector('n1', -100, 4000, 3600, 60)!.range).toEqual({ startS: 0, endS: 3600 })
  })
})
```

- [ ] **Step 2: Run to verify fail** — `npm test`, cannot resolve module.

- [ ] **Step 3: Implement**

`src/app/screens/activity/chart-geometry.ts`:

```ts
import type { Exclusions, Sector, TimeRange } from '../../../domain/model/types'

export function pxToleranceS(pxTol: number, domainS: number, plotWidthPx: number): number {
  if (plotWidthPx <= 0) return Infinity
  return (pxTol / plotWidthPx) * domainS
}

export type DragTarget =
  | { kind: 'create' }
  | { kind: 'move-sector'; id: string }
  | { kind: 'resize-start'; id: string }
  | { kind: 'resize-end'; id: string }
  | { kind: 'trim-warmup' }
  | { kind: 'trim-cooldown' }

interface EdgeCandidate {
  timeS: number
  target: DragTarget
}

export function hitTest(
  timeS: number,
  sectors: Sector[],
  ex: Exclusions,
  tolS: number,
): DragTarget {
  const edges: EdgeCandidate[] = [
    { timeS: ex.warmupEndS, target: { kind: 'trim-warmup' } },
    { timeS: ex.cooldownStartS, target: { kind: 'trim-cooldown' } },
  ]
  for (const s of sectors) {
    edges.push({ timeS: s.range.startS, target: { kind: 'resize-start', id: s.id } })
    edges.push({ timeS: s.range.endS, target: { kind: 'resize-end', id: s.id } })
  }
  let best: EdgeCandidate | null = null
  let bestDist = Infinity
  for (const e of edges) {
    const d = Math.abs(e.timeS - timeS)
    if (d <= tolS && d < bestDist) {
      bestDist = d
      best = e
    }
  }
  if (best) return best.target
  for (const s of sectors) {
    if (timeS >= s.range.startS && timeS < s.range.endS) {
      return { kind: 'move-sector', id: s.id }
    }
  }
  return { kind: 'create' }
}

export interface DragResult {
  sectors: Sector[]
  exclusions: Exclusions
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function applyDrag(
  target: DragTarget,
  sectors: Sector[],
  ex: Exclusions,
  grabTimeS: number,
  currentTimeS: number,
  durationS: number,
  minWidthS: number,
): DragResult {
  if (target.kind === 'trim-warmup') {
    return {
      sectors,
      exclusions: {
        warmupEndS: clamp(currentTimeS, 0, ex.cooldownStartS - minWidthS),
        cooldownStartS: ex.cooldownStartS,
      },
    }
  }
  if (target.kind === 'trim-cooldown') {
    return {
      sectors,
      exclusions: {
        warmupEndS: ex.warmupEndS,
        cooldownStartS: clamp(currentTimeS, ex.warmupEndS + minWidthS, durationS),
      },
    }
  }
  const id = target.id
  const mapRange = (s: Sector): TimeRange => {
    const { startS, endS } = s.range
    if (target.kind === 'resize-start') {
      return { startS: clamp(currentTimeS, 0, endS - minWidthS), endS }
    }
    if (target.kind === 'resize-end') {
      return { startS, endS: clamp(currentTimeS, startS + minWidthS, durationS) }
    }
    // move-sector: shift preserving width, clamped into bounds
    const width = endS - startS
    const delta = currentTimeS - grabTimeS
    const newStart = clamp(startS + delta, 0, durationS - width)
    return { startS: newStart, endS: newStart + width }
  }
  return {
    sectors: sectors.map((s) => (s.id === id ? { ...s, range: mapRange(s) } : s)),
    exclusions: ex,
  }
}

export function createSector(
  id: string,
  aS: number,
  bS: number,
  durationS: number,
  minWidthS: number,
): Sector | null {
  const startS = clamp(Math.min(aS, bS), 0, durationS)
  const endS = clamp(Math.max(aS, bS), 0, durationS)
  if (endS - startS < minWidthS) return null
  return { id, activityId: '', range: { startS, endS }, label: '', kind: 'sector' }
}
```

- [ ] **Step 4: Verify pass; commit**

```bash
git add -A && git commit -m "feat(workspace): pure chart geometry - hit-testing, drag application, sector creation"
```

---

### Task 2: Channel metadata + workspace store

**Files:**
- Create: `src/app/channels.ts`, `src/app/channels.test.ts`, `src/app/screens/activity/workspace-store.ts`, `src/app/screens/activity/workspace-store.test.ts`
- Modify: `package.json` (install zustand)

**Interfaces:**
- Produces:
  - `src/app/channels.ts`: `type DisplayChannel = 'heartRate' | 'pace' | 'power' | 'cadence' | 'altitude'`; `interface ChannelMeta { key: DisplayChannel; sourceChannel: ChannelKind; label: string; colorHex: string; invert: boolean; format(v: number): string }`; `CHANNELS: ChannelMeta[]` (pace maps to `sourceChannel: 'speed'`, `invert: true`, `format` = pace string); `channelsPresent(a: Activity): ChannelMeta[]` (meta whose source channel exists).
  - workspace store (zustand): state `{ visible: Set<DisplayChannel>; driftChannel: DriftChannel; sectors: Sector[]; exclusions: Exclusions; selectedSectorId: string | null }` + actions `init(activity, sectors)`, `toggleChannel(c)`, `setDriftChannel(c)`, `setSectors(s)`, `setExclusions(e)`, `select(id)`, `removeSector(id)`. Store is created per-activity via a factory `createWorkspaceStore()` returning a `useStore` hook (avoids global singleton across activities).

- [ ] **Step 1: Install zustand**

```bash
npm install zustand
```

- [ ] **Step 2: Write the failing tests**

`src/app/channels.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { syntheticActivity, syntheticSeries } from '../domain/testing/synthetic'
import { CHANNELS, channelsPresent } from './channels'

describe('channels', () => {
  it('maps pace to the speed source channel, inverted', () => {
    const pace = CHANNELS.find((c) => c.key === 'pace')!
    expect(pace.sourceChannel).toBe('speed')
    expect(pace.invert).toBe(true)
    expect(pace.format(2.5059)).toBe('6:39')
  })

  it('formats heart rate as integer bpm', () => {
    const hr = CHANNELS.find((c) => c.key === 'heartRate')!
    expect(hr.format(159.4)).toBe('159')
  })

  it('lists only channels whose source is present', () => {
    const a = syntheticActivity({
      durationS: 60,
      channels: { heartRate: syntheticSeries({ durationS: 60, value: () => 150 }) },
    })
    expect(channelsPresent(a).map((c) => c.key)).toEqual(['heartRate'])
  })
})
```

`src/app/screens/activity/workspace-store.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Sector } from '../../../domain/model/types'
import { syntheticActivity, syntheticSeries } from '../../../domain/testing/synthetic'
import { createWorkspaceStore } from './workspace-store'

function activity() {
  return syntheticActivity({
    durationS: 3600,
    channels: {
      heartRate: syntheticSeries({ durationS: 3600, value: () => 150 }),
      speed: syntheticSeries({ durationS: 3600, value: () => 3 }),
      power: syntheticSeries({ durationS: 3600, value: () => 200 }),
    },
    exclusions: { warmupEndS: 120, cooldownStartS: 3600 },
  })
}
const sector: Sector = {
  id: 's1',
  activityId: 'test-activity',
  range: { startS: 600, endS: 1200 },
  label: '',
  kind: 'sector',
}

describe('workspace store', () => {
  it('initializes visible channels, drift default, exclusions from the activity', () => {
    const useStore = createWorkspaceStore()
    useStore.getState().init(activity(), [sector])
    const s = useStore.getState()
    expect([...s.visible]).toContain('heartRate')
    expect([...s.visible]).toContain('pace')
    expect(s.driftChannel).toBe('speed')
    expect(s.exclusions).toEqual({ warmupEndS: 120, cooldownStartS: 3600 })
    expect(s.sectors).toHaveLength(1)
  })

  it('toggles channel visibility', () => {
    const useStore = createWorkspaceStore()
    useStore.getState().init(activity(), [])
    useStore.getState().toggleChannel('power')
    expect(useStore.getState().visible.has('power')).toBe(false)
    useStore.getState().toggleChannel('power')
    expect(useStore.getState().visible.has('power')).toBe(true)
  })

  it('selects and removes sectors', () => {
    const useStore = createWorkspaceStore()
    useStore.getState().init(activity(), [sector])
    useStore.getState().select('s1')
    expect(useStore.getState().selectedSectorId).toBe('s1')
    useStore.getState().removeSector('s1')
    expect(useStore.getState().sectors).toEqual([])
    expect(useStore.getState().selectedSectorId).toBeNull()
  })

  it('sets drift channel', () => {
    const useStore = createWorkspaceStore()
    useStore.getState().init(activity(), [])
    useStore.getState().setDriftChannel('power')
    expect(useStore.getState().driftChannel).toBe('power')
  })
})
```

- [ ] **Step 3: Run to verify fail** — missing modules.

- [ ] **Step 4: Implement**

`src/app/channels.ts`:

```ts
import type { Activity, ChannelKind, DriftChannel } from '../domain/model/types'
import { formatPace } from './format'

export type DisplayChannel = 'heartRate' | 'pace' | 'power' | 'cadence' | 'altitude'

export interface ChannelMeta {
  key: DisplayChannel
  sourceChannel: ChannelKind
  label: string
  colorHex: string
  invert: boolean
  format(v: number): string
}

export const CHANNELS: ChannelMeta[] = [
  {
    key: 'heartRate',
    sourceChannel: 'heartRate',
    label: 'Heart rate',
    colorHex: '#ff6b6b',
    invert: false,
    format: (v) => String(Math.round(v)),
  },
  {
    key: 'pace',
    sourceChannel: 'speed',
    label: 'Pace',
    colorHex: '#4cc9f0',
    invert: true,
    format: (v) => formatPace(v).replace(' /km', ''),
  },
  {
    key: 'power',
    sourceChannel: 'power',
    label: 'Power',
    colorHex: '#a78bfa',
    invert: false,
    format: (v) => String(Math.round(v)),
  },
  {
    key: 'cadence',
    sourceChannel: 'cadence',
    label: 'Cadence',
    colorHex: '#ffc53d',
    invert: false,
    format: (v) => String(Math.round(v)),
  },
  {
    key: 'altitude',
    sourceChannel: 'altitude',
    label: 'Altitude',
    colorHex: '#6bcb77',
    invert: false,
    format: (v) => String(Math.round(v)),
  },
]

/** The DriftChannel selector (speed|power) maps to these display channels' sources. */
export function driftChannelLabel(c: DriftChannel): string {
  return c === 'speed' ? 'Pace (Pa:HR)' : 'Power (Pw:HR)'
}

export function channelsPresent(a: Activity): ChannelMeta[] {
  return CHANNELS.filter((c) => a.channels[c.sourceChannel] !== undefined)
}
```

`src/app/screens/activity/workspace-store.ts`:

```ts
import { createStore, useStore as useZustandStore } from 'zustand'
import type { Activity, DriftChannel, Exclusions, Sector } from '../../../domain/model/types'
import { channelsPresent, type DisplayChannel } from '../../channels'

export interface WorkspaceState {
  visible: Set<DisplayChannel>
  driftChannel: DriftChannel
  sectors: Sector[]
  exclusions: Exclusions
  selectedSectorId: string | null
  init(activity: Activity, sectors: Sector[]): void
  toggleChannel(c: DisplayChannel): void
  setDriftChannel(c: DriftChannel): void
  setSectors(sectors: Sector[]): void
  setExclusions(ex: Exclusions): void
  select(id: string | null): void
  removeSector(id: string): void
}

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>

export function createWorkspaceStore() {
  return createStore<WorkspaceState>((set) => ({
    visible: new Set(),
    driftChannel: 'speed',
    sectors: [],
    exclusions: { warmupEndS: 0, cooldownStartS: 0 },
    selectedSectorId: null,
    init: (activity, sectors) =>
      set({
        visible: new Set(channelsPresent(activity).map((c) => c.key)),
        driftChannel: activity.channels.power ? 'speed' : 'speed',
        sectors,
        exclusions: activity.exclusions,
        selectedSectorId: null,
      }),
    toggleChannel: (c) =>
      set((s) => {
        const visible = new Set(s.visible)
        if (visible.has(c)) visible.delete(c)
        else visible.add(c)
        return { visible }
      }),
    setDriftChannel: (driftChannel) => set({ driftChannel }),
    setSectors: (sectors) => set({ sectors }),
    setExclusions: (exclusions) => set({ exclusions }),
    select: (selectedSectorId) => set({ selectedSectorId }),
    removeSector: (id) =>
      set((s) => ({
        sectors: s.sectors.filter((sec) => sec.id !== id),
        selectedSectorId: s.selectedSectorId === id ? null : s.selectedSectorId,
      })),
  }))
}

/** Bind a component to a slice of a per-activity store. */
export function useWorkspace<T>(store: WorkspaceStore, selector: (s: WorkspaceState) => T): T {
  return useZustandStore(store, selector)
}
```

- [ ] **Step 5: Verify pass; commit**

```bash
git add -A && git commit -m "feat(workspace): channel metadata and per-activity Zustand store"
```

---

### Task 3: uPlot chart stack (wrapper + overlay + interactions)

**Files:**
- Create: `src/app/screens/activity/chart-stack.tsx`
- Modify: `src/main.tsx` (import uPlot CSS)

**Interfaces:**
- Consumes: geometry (Task 1), store (Task 2), channel meta, `nonExcludedRange`.
- Produces: `ChartStack({ activity, store })` — renders one canvas-guarded uPlot pane per visible channel, synced crosshair, overlay bands for sectors + selected highlight + excluded shading, and pointer interactions that create/move/resize sectors and drag trims, committing to the store on pointer-up. **Not unit-tested** (canvas); the module guards `document.createElement('canvas').getContext('2d')` and renders labelled placeholders when absent so it stays importable in jsdom.

- [ ] **Step 1: Import uPlot CSS**

Add to `src/main.tsx` after `./index.css`:

```tsx
import 'uplot/dist/uPlot.min.css'
```

- [ ] **Step 2: Implement the chart stack**

`src/app/screens/activity/chart-stack.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import uPlot, { type AlignedData, type Options } from 'uplot'
import { useStore as useZustand } from 'zustand'
import type { Activity } from '../../../domain/model/types'
import { CHANNELS, type ChannelMeta } from '../../channels'
import type { WorkspaceStore } from './workspace-store'
import { applyDrag, createSector, hitTest, pxToleranceS, type DragTarget } from './chart-geometry'

const canvasAvailable = (() => {
  try {
    return document.createElement('canvas').getContext('2d') != null
  } catch {
    return false
  }
})()

const SYNC_KEY = 'workspace-x'
const EDGE_TOL_PX = 6
const MIN_SECTOR_S = 5
let sectorSeq = 0

interface Drag {
  target: DragTarget
  grabTimeS: number
  pane: uPlot
}

export function ChartStack({ activity, store }: { activity: Activity; store: WorkspaceStore }) {
  const visible = useZustand(store, (s) => s.visible)
  const containerRef = useRef<HTMLDivElement>(null)
  const panesRef = useRef<uPlot[]>([])
  const dragRef = useRef<Drag | null>(null)

  const metas = CHANNELS.filter(
    (c) => visible.has(c.key) && activity.channels[c.sourceChannel],
  )

  useEffect(() => {
    if (!canvasAvailable || !containerRef.current) return
    const container = containerRef.current
    const sync = uPlot.sync(SYNC_KEY)
    const panes: uPlot[] = []

    const domainMax = activity.durationS

    const overlay = (u: uPlot) => {
      const { sectors, exclusions, selectedSectorId } = store.getState()
      const ctx = u.ctx
      const top = u.bbox.top
      const h = u.bbox.height
      const xpos = (t: number) => u.valToPos(t, 'x', true)
      // excluded shading
      ctx.save()
      ctx.fillStyle = 'rgba(11,14,20,0.66)'
      ctx.fillRect(xpos(0), top, xpos(exclusions.warmupEndS) - xpos(0), h)
      ctx.fillRect(
        xpos(exclusions.cooldownStartS),
        top,
        xpos(domainMax) - xpos(exclusions.cooldownStartS),
        h,
      )
      // sectors
      for (const s of sectors) {
        const x0 = xpos(s.range.startS)
        const x1 = xpos(s.range.endS)
        ctx.fillStyle = s.id === selectedSectorId ? 'rgba(91,157,255,0.18)' : 'rgba(91,157,255,0.09)'
        ctx.fillRect(x0, top, x1 - x0, h)
        ctx.strokeStyle = 'rgba(91,157,255,0.5)'
        ctx.strokeRect(x0, top, x1 - x0, h)
      }
      ctx.restore()
    }

    const redrawAll = () => panes.forEach((p) => p.redraw())

    metas.forEach((meta) => {
      const paneEl = document.createElement('div')
      container.appendChild(paneEl)
      const series = activity.channels[meta.sourceChannel]!
      const data: AlignedData = [series.t, series.v]
      const opts: Options = {
        title: meta.label,
        width: container.clientWidth || 900,
        height: 140,
        cursor: { sync: { key: SYNC_KEY }, drag: { x: false, y: false } },
        scales: { x: { time: false, min: 0, max: domainMax }, y: { dir: meta.invert ? -1 : 1 } },
        legend: { show: false },
        axes: [
          { stroke: '#8a97a5', grid: { stroke: '#232b36' }, ticks: { stroke: '#232b36' } },
          {
            stroke: '#8a97a5',
            grid: { stroke: '#232b36' },
            ticks: { stroke: '#232b36' },
            values: (_u, splits) => splits.map((v) => meta.format(v)),
          },
        ],
        series: [{}, { stroke: meta.colorHex, width: 1.25, points: { show: false } }],
        plugins: [{ hooks: { draw: overlay } }],
      }
      const u = new uPlot(opts, data, paneEl)
      attachInteractions(u, meta)
      panes.push(u)
    })

    function attachInteractions(u: uPlot, _meta: ChannelMeta) {
      const timeAt = (e: PointerEvent) => u.posToVal(e.offsetX, 'x')
      u.over.style.touchAction = 'none'
      u.over.addEventListener('pointerdown', (e) => {
        const tolS = pxToleranceS(EDGE_TOL_PX, domainMax, u.over.clientWidth)
        const t = timeAt(e)
        const { sectors, exclusions } = store.getState()
        const target = hitTest(t, sectors, exclusions, tolS)
        dragRef.current = { target, grabTimeS: t, pane: u }
        if (target.kind.startsWith('resize') || target.kind === 'move-sector') {
          const id = 'id' in target ? target.id : null
          if (id) store.getState().select(id)
        }
        u.over.setPointerCapture(e.pointerId)
      })
      u.over.addEventListener('pointermove', (e) => {
        const drag = dragRef.current
        if (!drag) return
        const t = timeAt(e)
        if (drag.target.kind === 'create') {
          redrawAll() // live create handled on up; keep crosshair responsive
          return
        }
        const { sectors, exclusions } = store.getState()
        const r = applyDrag(
          drag.target,
          sectors,
          exclusions,
          drag.grabTimeS,
          t,
          domainMax,
          MIN_SECTOR_S,
        )
        store.getState().setSectors(r.sectors)
        store.getState().setExclusions(r.exclusions)
        redrawAll()
      })
      const finish = (e: PointerEvent) => {
        const drag = dragRef.current
        if (!drag) return
        if (drag.target.kind === 'create') {
          const s = createSector(
            `sec-${Date.now()}-${sectorSeq++}`,
            drag.grabTimeS,
            timeAt(e),
            domainMax,
            MIN_SECTOR_S,
          )
          if (s) {
            const withActivity = { ...s, activityId: activity.id }
            store.getState().setSectors([...store.getState().sectors, withActivity])
            store.getState().select(withActivity.id)
          }
        }
        dragRef.current = null
        redrawAll()
      }
      u.over.addEventListener('pointerup', finish)
      u.over.addEventListener('pointercancel', () => {
        dragRef.current = null
      })
    }

    panesRef.current = panes
    const unsub = store.subscribe(redrawAll)
    const onResize = () =>
      panes.forEach((p) => p.setSize({ width: container.clientWidth || 900, height: 140 }))
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      unsub()
      panes.forEach((p) => p.destroy())
      container.replaceChildren()
      sync.sub && sync.unsub?.(panes[0]!)
    }
    // rebuild when the visible-channel set changes
  }, [activity, store, metas.map((m) => m.key).join(',')])

  if (!canvasAvailable) {
    return (
      <div ref={containerRef} data-testid="chart-stack-placeholder" className="space-y-3">
        {metas.map((m) => (
          <div
            key={m.key}
            className="flex h-[140px] items-center justify-center rounded border border-line bg-surface text-xs text-ink-muted"
          >
            {m.label} chart
          </div>
        ))}
      </div>
    )
  }
  return <div ref={containerRef} className="space-y-3" />
}
```

- [ ] **Step 3: Typecheck, lint, build** (no unit test — canvas). Delete any genuinely-unused import to satisfy `noUnusedLocals`/eslint.

Run: `npm run lint && npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(workspace): uPlot chart stack with synced crosshair, sector/trim overlays and pointer editing"
```

---

### Task 4: Stats panel

**Files:**
- Create: `src/app/screens/activity/stats-panel.tsx`, `src/app/screens/activity/stats-panel.test.tsx`

**Interfaces:**
- Consumes: `sectorStats` (m1), `computeDecoupling` (m1), `nonExcludedRange`, channel meta, format utils.
- Produces: `StatsPanel({ activity, sectors, exclusions, driftChannel, selectedSectorId })` — presentational. Shows a whole-run column (over the non-excluded range) and, when a sector is selected, that sector's per-channel avg/max, a first-half vs second-half table, and decoupling % over the sector for the drift channel (guarded: shows "—" when the drift channel or HR is missing or a half has no data).

- [ ] **Step 1: Write the failing test**

`src/app/screens/activity/stats-panel.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Sector } from '../../../domain/model/types'
import { syntheticActivity, syntheticSeries } from '../../../domain/testing/synthetic'
import { StatsPanel } from './stats-panel'

afterEach(cleanup)

function activity() {
  return syntheticActivity({
    durationS: 3600,
    channels: {
      heartRate: syntheticSeries({ durationS: 3600, value: (t) => (t < 1800 ? 150 : 150 / 0.95) }),
      speed: syntheticSeries({ durationS: 3600, value: () => 3 }),
    },
  })
}
const sector: Sector = {
  id: 's1',
  activityId: 'test-activity',
  range: { startS: 0, endS: 3600 },
  label: '',
  kind: 'sector',
}

describe('StatsPanel', () => {
  it('shows whole-run averages', () => {
    render(
      <StatsPanel
        activity={activity()}
        sectors={[]}
        exclusions={{ warmupEndS: 0, cooldownStartS: 3600 }}
        driftChannel="speed"
        selectedSectorId={null}
      />,
    )
    expect(screen.getByText(/whole run/i)).toBeInTheDocument()
  })

  it('shows sector decoupling for the selected sector', () => {
    render(
      <StatsPanel
        activity={activity()}
        sectors={[sector]}
        exclusions={{ warmupEndS: 0, cooldownStartS: 3600 }}
        driftChannel="speed"
        selectedSectorId="s1"
      />,
    )
    // the synthetic HR climbs so decoupling ≈ 5.0%
    expect(screen.getByText(/decoupling/i)).toBeInTheDocument()
    expect(screen.getByText('5.0%')).toBeInTheDocument()
    expect(screen.getByText(/1st half/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify fail** — missing module.

- [ ] **Step 3: Implement**

`src/app/screens/activity/stats-panel.tsx`:

```tsx
import { computeDecoupling } from '../../../domain/analysis/decoupling'
import { sectorStats } from '../../../domain/analysis/sector-stats'
import { windowStats } from '../../../domain/analysis/stats'
import { nonExcludedRange } from '../../../domain/model/series'
import type { Activity, DriftChannel, Exclusions, Sector, TimeRange } from '../../../domain/model/types'
import { CHANNELS } from '../../channels'
import { formatDuration } from '../../format'

function decouplingText(a: Activity, range: TimeRange, drift: DriftChannel): string {
  const out = a.channels[drift]
  const hr = a.channels.heartRate
  if (!out || !hr) return '—'
  try {
    return `${computeDecoupling(out, hr, range).decouplingPct.toFixed(1)}%`
  } catch {
    return '—'
  }
}

function ChannelRows({ a, range }: { a: Activity; range: TimeRange }) {
  return (
    <>
      {CHANNELS.filter((c) => a.channels[c.sourceChannel]).map((c) => {
        const st = windowStats(a.channels[c.sourceChannel]!, range)
        return (
          <tr key={c.key} className="border-b border-line/40">
            <td className="py-1 pr-4" style={{ color: c.colorHex }}>
              {c.label}
            </td>
            <td className="py-1 pr-4 text-right tabular-nums">
              {Number.isNaN(st.mean) ? '—' : c.format(st.mean)}
            </td>
            <td className="py-1 text-right tabular-nums text-ink-muted">
              {Number.isNaN(st.max) ? '—' : c.format(st.max)}
            </td>
          </tr>
        )
      })}
    </>
  )
}

export function StatsPanel({
  activity,
  sectors,
  exclusions,
  driftChannel,
  selectedSectorId,
}: {
  activity: Activity
  sectors: Sector[]
  exclusions: Exclusions
  driftChannel: DriftChannel
  selectedSectorId: string | null
}) {
  const whole = nonExcludedRange({ ...activity, exclusions })
  const selected = sectors.find((s) => s.id === selectedSectorId) ?? null

  return (
    <div className="space-y-6 font-mono text-sm">
      <section>
        <h3 className="mb-1 text-[10px] uppercase tracking-widest text-ink-muted">
          Whole run · {formatDuration(whole.endS - whole.startS)}
        </h3>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-ink-muted">
              <th className="py-1 text-left font-medium">channel</th>
              <th className="py-1 text-right font-medium">avg</th>
              <th className="py-1 text-right font-medium">max</th>
            </tr>
          </thead>
          <tbody>
            <ChannelRows a={activity} range={whole} />
          </tbody>
        </table>
      </section>

      {selected && (
        <SectorStatsBlock
          activity={activity}
          range={selected.range}
          driftChannel={driftChannel}
        />
      )}
    </div>
  )
}

function SectorStatsBlock({
  activity,
  range,
  driftChannel,
}: {
  activity: Activity
  range: TimeRange
  driftChannel: DriftChannel
}) {
  const stats = sectorStats(activity, range)
  const driftLabel = driftChannel === 'speed' ? 'Pa:HR' : 'Pw:HR'
  return (
    <section>
      <h3 className="mb-1 text-[10px] uppercase tracking-widest text-ink-muted">
        Sector · {formatDuration(range.endS - range.startS)}
      </h3>
      <div className="mb-3 flex items-baseline justify-between rounded border border-line bg-surface px-3 py-2">
        <span className="text-[10px] uppercase tracking-widest text-ink-muted">
          Decoupling ({driftLabel})
        </span>
        <span className="text-xl tabular-nums">{decouplingText(activity, range, driftChannel)}</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-ink-muted">
            <th className="py-1 text-left font-medium">channel</th>
            <th className="py-1 text-right font-medium">1st half</th>
            <th className="py-1 text-right font-medium">2nd half</th>
          </tr>
        </thead>
        <tbody>
          {CHANNELS.filter((c) => stats[c.sourceChannel]).map((c) => {
            const cs = stats[c.sourceChannel]!
            return (
              <tr key={c.key} className="border-b border-line/40">
                <td className="py-1 pr-4" style={{ color: c.colorHex }}>
                  {c.label}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {Number.isNaN(cs.firstHalf.mean) ? '—' : c.format(cs.firstHalf.mean)}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {Number.isNaN(cs.secondHalf.mean) ? '—' : c.format(cs.secondHalf.mean)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
```

- [ ] **Step 4: Verify pass; commit**

```bash
git add -A && git commit -m "feat(workspace): stats panel with whole-run and per-sector splits and decoupling"
```

---

### Task 5: Notes panel

**Files:**
- Create: `src/app/screens/activity/notes-panel.tsx`, `src/app/screens/activity/notes-panel.test.tsx`

**Interfaces:**
- Produces: `NotesPanel({ initialText, onSave })` — a textarea that debounces (400ms) and calls `onSave(text)`; shows a subtle "saved" indicator after a successful save. Presentational; the screen wires `onSave` to the repo.

- [ ] **Step 1: Write the failing test**

`src/app/screens/activity/notes-panel.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotesPanel } from './notes-panel'

afterEach(cleanup)

describe('NotesPanel', () => {
  it('debounces and saves typed text', async () => {
    const onSave = vi.fn()
    render(<NotesPanel initialText="" onSave={onSave} />)
    await userEvent.type(screen.getByRole('textbox'), 'felt strong')
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('felt strong'), { timeout: 1500 })
  })

  it('renders the initial text', () => {
    render(<NotesPanel initialText="prior note" onSave={vi.fn()} />)
    expect(screen.getByRole('textbox')).toHaveValue('prior note')
  })
})
```

- [ ] **Step 2: Run to verify fail** — missing module.

- [ ] **Step 3: Implement**

`src/app/screens/activity/notes-panel.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'

export function NotesPanel({
  initialText,
  onSave,
}: {
  initialText: string
  onSave: (text: string) => void
}) {
  const [text, setText] = useState(initialText)
  const [saved, setSaved] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      onSave(text)
      setSaved(true)
    }, 400)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [text, onSave])

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-widest text-ink-muted">Notes</h3>
        {saved && <span className="text-[10px] text-ok">saved</span>}
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setSaved(false)
        }}
        placeholder="How did it feel? Conditions, RPE, anything worth remembering."
        className="h-32 w-full resize-y rounded border border-line bg-surface p-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify pass; commit**

```bash
git add -A && git commit -m "feat(workspace): autosaving notes panel"
```

---

### Task 6: Workspace screen (wire-up + persistence)

**Files:**
- Rewrite: `src/app/screens/activity/activity-screen.tsx`
- Create: `src/app/screens/activity/use-workspace-persistence.ts`, `src/app/screens/activity/activity-screen.test.tsx`

**Interfaces:**
- Consumes: everything above, container/hooks, repo.
- Produces: the full workspace screen — loads the activity + its sectors + note, builds a per-activity store, renders the channel rail (visibility toggles + drift-channel selector), the chart stack, the stats panel, and the notes panel; **persists** sector changes (debounced), exclusion changes, and notes to the repo. A `use-workspace-persistence` hook subscribes to the store and writes through diffs (add/update/remove sectors, update exclusions). The jsdom test drives everything except the canvas (guarded placeholder) with a real `InMemoryLibraryRepository`.

- [ ] **Step 1: Write the failing test**

`src/app/screens/activity/activity-screen.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GarminFitFileParser } from '../../../adapters/fit/fit-file-parser'
import { InMemoryLibraryRepository } from '../../../adapters/storage/in-memory-library-repository'
import { fixtureBytes } from '../../../adapters/testing/fixtures'
import { ContainerProvider } from '../../container-context'
import { ActivityScreen } from './activity-screen'

afterEach(cleanup)

async function seed() {
  const repo = new InMemoryLibraryRepository()
  const parser = new GarminFitFileParser()
  const [outcome] = await parser.parse(fixtureBytes('Activity.fit'), 'Activity.fit')
  if (!outcome!.ok) throw new Error('fixture parse failed')
  await repo.saveActivity(outcome!.activity, outcome!.rawBytes)
  return { repo, parser, id: outcome!.activity.id }
}

function renderAt(container: { repo: InMemoryLibraryRepository; parser: GarminFitFileParser }, id: string) {
  render(
    <MemoryRouter initialEntries={[`/activity/${id}`]}>
      <ContainerProvider container={{ ...container, persistent: true }}>
        <Routes>
          <Route path="/activity/:id" element={<ActivityScreen />} />
        </Routes>
      </ContainerProvider>
    </MemoryRouter>,
  )
}

describe('ActivityScreen workspace', () => {
  it('loads the run and shows the channel rail and stats', async () => {
    const { repo, parser, id } = await seed()
    renderAt({ repo, parser }, id)
    expect(await screen.findByText(/whole run/i)).toBeInTheDocument()
    // channel rail lists present channels (Activity.fit has HR, pace, power, cadence, altitude)
    expect(screen.getByRole('button', { name: /heart rate/i })).toBeInTheDocument()
  })

  it('persists a note through the repository', async () => {
    const { repo, parser, id } = await seed()
    renderAt({ repo, parser }, id)
    const textbox = await screen.findByRole('textbox')
    await userEvent.type(textbox, 'tempo run')
    await waitFor(async () => expect((await repo.getNote(id))?.text).toBe('tempo run'), {
      timeout: 2000,
    })
  })

  it('shows a not-found message for a missing id', async () => {
    const { repo, parser } = await seed()
    renderAt({ repo, parser }, 'nonexistent')
    expect(await screen.findByText(/run not found/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify fail** — the current placeholder screen has no rail/stats/notes.

- [ ] **Step 3: Implement the persistence hook**

`src/app/screens/activity/use-workspace-persistence.ts`:

```ts
import { useEffect, useRef } from 'react'
import type { LibraryRepository } from '../../../domain/ports/library-repository'
import type { Exclusions, Sector } from '../../../domain/model/types'
import type { WorkspaceStore } from './workspace-store'

/** Persists store sector/exclusion changes to the repo, debounced, via diffing. */
export function useWorkspacePersistence(
  store: WorkspaceStore,
  repo: LibraryRepository,
  activityId: string,
  ready: boolean,
) {
  const prevSectors = useRef<Map<string, Sector>>(new Map())
  const prevExclusions = useRef<Exclusions | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!ready) return
    // seed refs with the initial persisted state (no writes on first pass)
    const s = store.getState()
    prevSectors.current = new Map(s.sectors.map((sec) => [sec.id, sec]))
    prevExclusions.current = s.exclusions

    const flush = () => {
      const { sectors, exclusions } = store.getState()
      const now = new Map(sectors.map((sec) => [sec.id, sec]))
      // upserts
      for (const sec of sectors) {
        const prev = prevSectors.current.get(sec.id)
        if (!prev || JSON.stringify(prev) !== JSON.stringify(sec)) void repo.saveSector(sec)
      }
      // deletes
      for (const id of prevSectors.current.keys()) {
        if (!now.has(id)) void repo.deleteSector(id)
      }
      prevSectors.current = now
      if (
        prevExclusions.current &&
        (prevExclusions.current.warmupEndS !== exclusions.warmupEndS ||
          prevExclusions.current.cooldownStartS !== exclusions.cooldownStartS)
      ) {
        void repo.updateExclusions(activityId, exclusions)
      }
      prevExclusions.current = exclusions
    }

    const unsub = store.subscribe(() => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, 500)
    })
    return () => {
      if (timer.current) clearTimeout(timer.current)
      unsub()
    }
  }, [store, repo, activityId, ready])
}
```

- [ ] **Step 4: Rewrite the activity screen**

`src/app/screens/activity/activity-screen.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore as useZustand } from 'zustand'
import type { Activity } from '../../../domain/model/types'
import { channelsPresent, driftChannelLabel } from '../../channels'
import { useContainer } from '../../container-context'
import { ChartStack } from './chart-stack'
import { NotesPanel } from './notes-panel'
import { StatsPanel } from './stats-panel'
import { createWorkspaceStore, type WorkspaceStore } from './workspace-store'
import { useWorkspacePersistence } from './use-workspace-persistence'
import { cn } from '@/lib/utils'

export function ActivityScreen() {
  const { id } = useParams<{ id: string }>()
  const { repo } = useContainer()
  const [activity, setActivity] = useState<Activity | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const storeRef = useRef<WorkspaceStore>(createWorkspaceStore())

  useEffect(() => {
    if (!id) return
    let alive = true
    void (async () => {
      const a = await repo.getActivity(id)
      if (!alive) return
      if (a) {
        const sectors = await repo.listSectors(id)
        const n = await repo.getNote(id)
        storeRef.current.getState().init(a, sectors)
        setActivity(a)
        setNote(n?.text ?? '')
        setReady(true)
      }
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [repo, id])

  useWorkspacePersistence(storeRef.current, repo, id ?? '', ready)

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

  return <Workspace activity={activity} store={storeRef.current} initialNote={note} repo={repo} />
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
  repo: ReturnType<typeof useContainer>['repo']
}) {
  const visible = useZustand(store, (s) => s.visible)
  const driftChannel = useZustand(store, (s) => s.driftChannel)
  const sectors = useZustand(store, (s) => s.sectors)
  const exclusions = useZustand(store, (s) => s.exclusions)
  const selectedSectorId = useZustand(store, (s) => s.selectedSectorId)
  const present = useMemo(() => channelsPresent(activity), [activity])

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

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ChartStack activity={activity} store={store} />
        <div className="space-y-6">
          <StatsPanel
            activity={activity}
            sectors={sectors}
            exclusions={exclusions}
            driftChannel={driftChannel}
            selectedSectorId={selectedSectorId}
          />
          <NotesPanel
            initialText={initialNote}
            onSave={(text) =>
              void repo.saveNote({ activityId: activity.id, text, updatedAt: new Date() })
            }
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Full gate; commit**

Run: `npm test && npm run lint && npm run build`
Expected: all green.

Run: `grep -rE "from 'react|from 'dexie|@garmin|from 'uplot|from 'zustand|document\.|window\." src/domain/`
Expected: no output.

```bash
git add -A && git commit -m "feat(workspace): activity workspace screen wiring charts, rail, stats, notes with persistence"
```

---

### Task 7: Visual verification

- [ ] **Step 1:** `npm run dev`; with playwright-cli import `tests/fixtures/user-run-2026-07-05.fit`, open its workspace. Screenshot. Verify: stacked HR/pace/power/cadence/altitude panes render with channel colors; crosshair syncs across panes on hover; dragging on empty chart space creates a translucent sector; dragging its edges resizes it; the stats panel updates decoupling live; dragging the end handles shades a warmup region; typing a note persists (reload, note still there; sector still there).
- [ ] **Step 2:** Fix visual/interaction defects; re-verify; commit. Screenshot the final workspace.

## Definition of done (milestone 4)

- Full gate green (geometry/channels/store/stats/notes/screen tests + all prior), purity grep clean.
- In-browser: charts render and sync; sectors can be created/moved/resized by dragging; trims shade excluded regions; stats + decoupling update live; sectors, exclusions, and notes survive a reload.
- `npm run build` and `npm run dev` both work.
