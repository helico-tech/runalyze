# Milestone 8: Manual Laps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse FIT lap messages, keep the **manual** (button-press) laps distinct from auto-laps, and surface them in the workspace — a lap breakdown table in the details and dashed lap-boundary markers on the charts.

**Architecture:** `Activity` gains a `laps: Lap[]` field (normalized in the FIT adapter from `lapMesgs`, distinguishing `manual` / `auto` / `session-end` via `lapTrigger`). A `manualLaps(activity)` domain helper filters to button-press laps. Per-lap stats reuse a generalized `rangeSummary` (the existing `activitySummary`, refactored to take an explicit range). The workspace renders a `LapTable` and the chart-stack draws manual lap dividers.

**Tech Stack:** nothing new.

## Spike facts (verified 2026-07-05)

- `lapMesgs[i].lapTrigger` distinguishes laps: `manual` = button press; `time`/`distance`/`position*`/`fitnessEquipment` = auto; `sessionEnd` = the trailing partial lap.
- Each lap has `startTime` (Date) and `totalElapsedTime` (s). Lap range: `startS = (startTime − activityStart)/1000`, `endS = startS + totalElapsedTime`.
- Fixture truth: `user-long-run-2025-04-26.fit` has **3 manual laps** — [0, 7511.275], [7511.000, 9911.000], [9911.000, 10511.002] — plus a `sessionEnd` tail. `user-run-2026-07-05.fit` and `user-gap-run-2026-07-02.fit` have **0 manual laps** (auto `time` laps + a `sessionEnd`).

## Global Constraints

- All prior Global Constraints apply (strict TS, domain purity grep, TDD, commit style, `@/` alias, jsdom docblock, `TZ: 'UTC'`, no uPlot in vitest, fixture-manifest-before-tests).
- Adding required `laps: Lap[]` to `Activity` ripples to every Activity literal: `syntheticActivity` (default `[]`), `decode-fit` (parsed), and `container.test.ts`'s inline `{ id: 'x', … }`. Update all three. Old persisted activities lack `laps`; helpers guard with `?? []`.

---

### Task 1: Domain model + FIT lap parsing

**Files:**
- Modify: `src/domain/model/types.ts`, `src/domain/testing/synthetic.ts`, `src/domain/analysis/activity-summary.ts` + `.test.ts`, `src/adapters/fit/decode-fit.ts` + `.test.ts`, `src/app/container.test.ts`, `tests/fixtures/fixtures-manifest.md`
- Create: `src/domain/model/laps.ts`, `src/domain/model/laps.test.ts`

**Interfaces:**
- `types.ts`: `type LapTrigger = 'manual' | 'auto' | 'session-end'`; `interface Lap { index: number; range: TimeRange; trigger: LapTrigger }`; add `laps: Lap[]` to `Activity`.
- `laps.ts`: `manualLaps(a: Activity): Lap[]` → `(a.laps ?? []).filter((l) => l.trigger === 'manual')`.
- `activity-summary.ts`: extract `rangeSummary(a: Activity, range: TimeRange): ActivitySummary` (the current per-channel logic over any range); `activitySummary(a)` becomes `rangeSummary(a, nonExcludedRange(a))`. `ActivitySummary` gains no new fields; `durationS` is `range.endS − range.startS`.
- `decode-fit.ts`: parse `messages.lapMesgs` → `Lap[]` (normalize `lapTrigger`: `'manual'`→`manual`, `'sessionEnd'`→`session-end`, else `auto`; index by array position; range clamped to `[0, durationS]`).
- `synthetic.ts`: `SyntheticActivityOpts` gains optional `laps`; `syntheticActivity` sets `laps: opts.laps ?? []`.

- [ ] **Step 1: Add the manifest facts** — append a "Laps" line to each user-run section in `fixtures-manifest.md`: long-run 3 manual laps [0,7511.275],[7511,9911],[9911,10511.002]; user-run & gap-run 0 manual laps.

- [ ] **Step 2: Write the failing tests.**

`src/domain/model/laps.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { syntheticActivity } from '../testing/synthetic'
import { manualLaps } from './laps'
import type { Lap } from './types'

const laps: Lap[] = [
  { index: 0, range: { startS: 0, endS: 600 }, trigger: 'manual' },
  { index: 1, range: { startS: 600, endS: 1200 }, trigger: 'auto' },
  { index: 2, range: { startS: 1200, endS: 1300 }, trigger: 'session-end' },
]

describe('manualLaps', () => {
  it('keeps only button-press laps', () => {
    const a = syntheticActivity({ durationS: 1300, laps })
    expect(manualLaps(a).map((l) => l.index)).toEqual([0])
  })
  it('tolerates an activity with no laps field', () => {
    const a = syntheticActivity({ durationS: 60 })
    expect(manualLaps(a)).toEqual([])
  })
})
```

Append to `decode-fit.test.ts`:

```ts
it('parses manual laps from the long run (manifest values)', () => {
  const a = decodeFitActivity(fixtureBytes('user-long-run-2025-04-26.fit'), 'id-laps')
  const manual = a.laps.filter((l) => l.trigger === 'manual')
  expect(manual).toHaveLength(3)
  expect(manual[0]!.range.startS).toBe(0)
  expect(manual[0]!.range.endS).toBeCloseTo(7511.275, 2)
  expect(manual[1]!.range).toEqual({ startS: 7511, endS: 9911 })
  expect(manual[2]!.range.startS).toBe(9911)
})

it('marks auto-lap runs as having no manual laps', () => {
  const a = decodeFitActivity(fixtureBytes('user-run-2026-07-05.fit'), 'id-auto')
  expect(a.laps.some((l) => l.trigger === 'manual')).toBe(false)
  expect(a.laps.length).toBeGreaterThan(0) // auto + sessionEnd still parsed
})
```

Append to `activity-summary.test.ts`:

```ts
it('summarizes an arbitrary range via rangeSummary', () => {
  const a = syntheticActivity({
    durationS: 600,
    channels: { heartRate: syntheticSeries({ durationS: 600, value: (t) => (t < 300 ? 140 : 160) }) },
  })
  expect(rangeSummary(a, { startS: 300, endS: 600 }).avgHr).toBe(160)
})
```

(Import `rangeSummary` in that test.)

- [ ] **Step 3: Run to verify fail.**

- [ ] **Step 4: Implement.**

`types.ts` additions:

```ts
export type LapTrigger = 'manual' | 'auto' | 'session-end'

export interface Lap {
  index: number
  range: TimeRange
  trigger: LapTrigger
}
```

Add `laps: Lap[]` to `Activity` (after `exclusions`).

`src/domain/model/laps.ts`:

```ts
import type { Activity, Lap } from './types'

export function manualLaps(a: Activity): Lap[] {
  return (a.laps ?? []).filter((l) => l.trigger === 'manual')
}
```

`activity-summary.ts`: rename the body of `activitySummary` to `rangeSummary(a, range)`, keeping the same per-channel `avg`/distance logic but using the passed `range` and `durationS: range.endS - range.startS`; then:

```ts
export function activitySummary(a: Activity): ActivitySummary {
  return rangeSummary(a, nonExcludedRange(a))
}
```

(distance in `rangeSummary` = last minus first distance sample **within the range** — use `windowStats` sample bounds or filter; simplest: keep the current whole-channel last−first for `activitySummary` semantics, but for a range compute `distance.v` at the nearest indices to `range.startS`/`range.endS`. Use `nearestIndex` from `series.ts`: `distanceM = distByIdx(end) − distByIdx(start)` guarded for an empty channel. Confirm the existing `activitySummary` test still passes — whole-run range gives the same result.)

`synthetic.ts`: add `laps?: Lap[]` to `SyntheticActivityOpts` and `laps: opts.laps ?? []` to the returned activity (import `Lap`).

`decode-fit.ts`: after building channels/durationS, parse laps:

```ts
const laps: Lap[] = (messages.lapMesgs ?? [])
  .filter((l) => l.startTime)
  .map((l, index) => {
    const startS = Math.max(0, (l.startTime!.getTime() - startTime.getTime()) / 1000)
    const endS = Math.min(durationS, startS + (l.totalElapsedTime ?? 0))
    const trigger: LapTrigger =
      l.lapTrigger === 'manual' ? 'manual' : l.lapTrigger === 'sessionEnd' ? 'session-end' : 'auto'
    return { index, range: { startS, endS }, trigger }
  })
```

(Add `lapMesgs?: Array<{ startTime?: Date; totalElapsedTime?: number; lapTrigger?: string }>` to the `FitMessages` interface; import `Lap`, `LapTrigger`; add `laps` to the returned Activity.)

`container.test.ts`: add `laps: []` to the inline activity literal.

- [ ] **Step 5: Verify pass; commit.**

```bash
git add -A && git commit -m "feat(domain): parse FIT laps; manualLaps helper; rangeSummary; Activity.laps"
```

---

### Task 2: Lap details table + chart lap markers

**Files:**
- Create: `src/app/screens/activity/lap-table.tsx`, `src/app/screens/activity/lap-table.test.tsx`
- Modify: `src/app/screens/activity/activity-screen.tsx` (render LapTable when manual laps exist), `src/app/screens/activity/chart-stack.tsx` (draw manual lap dividers)

**Interfaces:**
- `LapTable({ activity })` — presentational; renders one row per `manualLaps(activity)`: `L{n}`, `start–end` (via `formatDuration`), duration, distance (`formatDistanceKm`), avg HR (`formatBpm`), avg pace (`formatPace`), avg power — each computed with `rangeSummary(activity, lap.range)`. Renders nothing when there are no manual laps.
- chart-stack overlay: after sector bands, for each `manualLaps(activity)` draw a dashed vertical line at `lap.range.startS` (and the final lap's `endS`) across the pane in amber `rgba(245,165,36,0.55)`; dedupe boundaries. Laps are display-only (not in `hitTest`).

- [ ] **Step 1: Write the failing test.**

`src/app/screens/activity/lap-table.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Lap } from '../../../domain/model/types'
import { syntheticActivity, syntheticSeries } from '../../../domain/testing/synthetic'
import { LapTable } from './lap-table'

afterEach(cleanup)

const laps: Lap[] = [
  { index: 0, range: { startS: 0, endS: 600 }, trigger: 'manual' },
  { index: 1, range: { startS: 600, endS: 1200 }, trigger: 'auto' },
]

describe('LapTable', () => {
  it('lists only manual laps with per-lap stats', () => {
    const a = syntheticActivity({
      durationS: 1200,
      laps,
      channels: { heartRate: syntheticSeries({ durationS: 1200, value: () => 150 }) },
    })
    render(<LapTable activity={a} />)
    expect(screen.getByText('L1')).toBeInTheDocument()
    expect(screen.queryByText('L2')).not.toBeInTheDocument() // auto lap excluded
    expect(screen.getByText('150 bpm')).toBeInTheDocument()
    expect(screen.getByText('10:00')).toBeInTheDocument() // 600 s duration
  })

  it('renders nothing without manual laps', () => {
    const a = syntheticActivity({ durationS: 60 })
    const { container } = render(<LapTable activity={a} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement** `lap-table.tsx` (using `manualLaps` + `rangeSummary` + format utils), then wire it into the workspace details column (below the stats/notes, or in a "Laps" section under the analysis row), and add the lap-divider drawing to the chart-stack overlay (`import { manualLaps }`).

- [ ] **Step 4: Full gate; commit.**

Run: `npm test && npm run lint && npm run build`. Purity grep clean.

```bash
git add -A && git commit -m "feat(workspace): manual-lap breakdown table and chart lap markers"
```

---

### Task 3: Visual verification

- [ ] **Step 1:** `npm run dev`; playwright-cli: import `user-long-run-2025-04-26.fit`, open its workspace. Confirm: dashed amber lap dividers at ~7511 s and ~9911 s across the charts; a Laps table listing L1/L2/L3 with durations (2:05:11 / 40:00 / 10:00), distances, and avg HR/pace/power. Import `user-run-2026-07-05.fit` and confirm no lap markers/table (auto-laps only). Screenshot.
- [ ] **Step 2:** Fix defects; re-verify; commit.

## Definition of done (milestone 8)

- Full gate green (laps/rangeSummary/decode/lap-table tests + all prior), purity grep clean, E2E still passes.
- In-browser: manual laps show as chart dividers + a details table on the long run; auto-lap-only runs show neither.
