# Everyday Run Metrics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an everyday-metrics layer to the activity screen — per-km splits, an HR time-in-zone bar driven by AeT/AnT, and grade-adjusted pace (GAP) as shared plumbing — plus a global manual-threshold escape hatch.

**Architecture:** Three pure domain modules under `src/domain/analysis/` (`grade-adjusted-pace.ts`, `splits.ts`, `zones.ts`), a global `Thresholds` singleton persisted through the existing `LibraryRepository` (new `settings` Dexie store), and three UI additions on the activity screen (`SplitsPanel`, `ZonesPanel` with an inline thresholds editor, and a GAP summary line in `StatsPanel`). GAP is a building block splits consume; zones resolve thresholds from a saved test on the run, falling back to the global value.

**Tech Stack:** nothing new — React + Zustand + Dexie + Vitest + Playwright, all already in the repo.

## Global Constraints

- Domain modules are **pure** (no I/O, no Date/random) and live in `src/domain/analysis/`.
- All timestamps/series follow existing conventions: `Series.t` strictly increasing, ranges half-open `[startS, endS)`.
- Sample-weighting must skip deltas exceeding `GAP_THRESHOLD_S` (60 s), mirroring `windowStats` — no naive sample counts.
- Metric units only (kilometres). No mile toggle.
- Minetti cost curve, verbatim: `Cr(i) = 155.4·i⁵ − 30.4·i⁴ − 43.3·i³ + 46.3·i² + 19.5·i + 3.6`, `Cr(0) = 3.6`.
- GAP smoothing window: `30` metres. Split length: `1000` metres.
- Follow existing panel styling (font-mono, `text-[10px] uppercase tracking-widest text-ink-muted` headers, `border-line`, `tabular-nums`).
- Test runner: `npx vitest run <file>`. E2E: `npx playwright test`.

## File Structure

- Create `src/domain/analysis/grade-adjusted-pace.ts` (+ test) — Minetti cost + `gradeAdjustedSpeed(a, range)`.
- Create `src/domain/analysis/splits.ts` (+ test) — `computeSplits(a)` → `Split[]`.
- Create `src/domain/analysis/zones.ts` (+ test) — `resolveThresholds(...)` + `computeZones(...)`.
- Modify `src/domain/model/types.ts` — add `Thresholds`.
- Modify `src/domain/ports/library-repository.ts` — add `getThresholds` / `saveThresholds`.
- Modify `src/adapters/storage/in-memory-library-repository.ts` — implement them.
- Modify `src/adapters/storage/dexie-library-repository.ts` — `settings` store, `version(2)`, implement.
- Modify `src/adapters/storage/library-repository-contract.ts` — round-trip test.
- Modify `src/app/hooks.ts` — `useThresholds`.
- Create `src/app/screens/activity/splits-panel.tsx` (+ test).
- Create `src/app/screens/activity/zones-panel.tsx` (+ test).
- Modify `src/app/screens/activity/stats-panel.tsx` — GAP summary line.
- Modify `src/app/screens/activity/activity-screen.tsx` — wire the two new panels.
- Modify `e2e/core-journeys.spec.ts` — zones journey.

---

### Task 1: Thresholds type + repository methods (in-memory) + contract test

**Files:**
- Modify: `src/domain/model/types.ts`
- Modify: `src/domain/ports/library-repository.ts`
- Modify: `src/adapters/storage/in-memory-library-repository.ts`
- Test: `src/adapters/storage/library-repository-contract.ts`

**Interfaces:**
- Produces: `interface Thresholds { aetHr: number | null; antHr: number | null; updatedAt: Date }`; `LibraryRepository.getThresholds(): Promise<Thresholds | null>`; `LibraryRepository.saveThresholds(t: Thresholds): Promise<void>`.

- [ ] **Step 1: Add the contract test**

In `src/adapters/storage/library-repository-contract.ts`, add inside `libraryRepositoryContract`'s `describe` block (after the existing tests):

```ts
    it('returns null thresholds before any are saved', async () => {
      const repo = makeRepo()
      expect(await repo.getThresholds()).toBeNull()
    })

    it('round-trips global thresholds', async () => {
      const repo = makeRepo()
      const t = { aetHr: 145, antHr: 168, updatedAt: new Date('2026-07-06T09:00:00Z') }
      await repo.saveThresholds(t)
      const loaded = await repo.getThresholds()
      expect(loaded).toEqual(t)
      expect(loaded!.updatedAt).toEqual(new Date('2026-07-06T09:00:00Z'))
    })

    it('overwrites thresholds on re-save', async () => {
      const repo = makeRepo()
      await repo.saveThresholds({ aetHr: 140, antHr: 160, updatedAt: new Date('2026-07-01T00:00:00Z') })
      await repo.saveThresholds({ aetHr: 145, antHr: null, updatedAt: new Date('2026-07-06T00:00:00Z') })
      const loaded = await repo.getThresholds()
      expect(loaded).toEqual({ aetHr: 145, antHr: null, updatedAt: new Date('2026-07-06T00:00:00Z') })
    })
```

- [ ] **Step 2: Run the contract against the in-memory repo to verify it fails**

Run: `npx vitest run src/adapters/storage/in-memory-library-repository.test.ts`
Expected: FAIL — `repo.getThresholds is not a function`.

- [ ] **Step 3: Add the `Thresholds` type**

In `src/domain/model/types.ts`, after the `Note` interface, add:

```ts
/** Global, single-athlete manual thresholds. One row for the whole app. */
export interface Thresholds {
  /** manual aerobic-threshold HR (bpm); null when never set */
  aetHr: number | null
  /** manual anaerobic-threshold HR (bpm); null when never set */
  antHr: number | null
  updatedAt: Date
}
```

- [ ] **Step 4: Extend the port**

In `src/domain/ports/library-repository.ts`, update the import and add the two methods to the `LibraryRepository` interface:

```ts
import type { Activity, Exclusions, Note, Sector, TestResult, Thresholds } from '../model/types'
```

```ts
  /** Global manual thresholds; null when never saved. */
  getThresholds(): Promise<Thresholds | null>
  saveThresholds(t: Thresholds): Promise<void>
```

- [ ] **Step 5: Implement in the in-memory repo**

In `src/adapters/storage/in-memory-library-repository.ts`, add the import for `Thresholds`:

```ts
import type { Activity, Exclusions, Note, Sector, TestResult, Thresholds } from '../../domain/model/types'
```

Add a field alongside the other maps:

```ts
  private thresholds: Thresholds | null = null
```

Add the two methods (e.g. after `getNote`):

```ts
  async getThresholds(): Promise<Thresholds | null> {
    return this.thresholds ? structuredClone(this.thresholds) : null
  }

  async saveThresholds(t: Thresholds): Promise<void> {
    this.thresholds = structuredClone(t)
  }
```

- [ ] **Step 6: Run the in-memory repo test to verify it passes**

Run: `npx vitest run src/adapters/storage/in-memory-library-repository.test.ts`
Expected: PASS (all contract tests including the three new ones).

- [ ] **Step 7: Commit**

```bash
git add src/domain/model/types.ts src/domain/ports/library-repository.ts src/adapters/storage/in-memory-library-repository.ts src/adapters/storage/library-repository-contract.ts
git commit -m "feat: global Thresholds singleton in repository port + in-memory impl"
```

---

### Task 2: Dexie thresholds store

**Files:**
- Modify: `src/adapters/storage/dexie-library-repository.ts`
- Test: `src/adapters/storage/dexie-library-repository.test.ts` (already runs the shared contract — no edit needed)

**Interfaces:**
- Consumes: `Thresholds`, `getThresholds`/`saveThresholds` from Task 1.

- [ ] **Step 1: Run the Dexie contract test to confirm it now fails**

Run: `npx vitest run src/adapters/storage/dexie-library-repository.test.ts`
Expected: FAIL — the new contract tests fail because Dexie doesn't implement `getThresholds`/`saveThresholds` yet.

- [ ] **Step 2: Add the settings store + row type**

In `src/adapters/storage/dexie-library-repository.ts`, add `Thresholds` to the type import:

```ts
import type { Activity, Exclusions, Note, Sector, TestResult, Thresholds } from '../../domain/model/types'
```

Add a row type near `RawFileRow`:

```ts
interface SettingsRow {
  key: string
  value: Thresholds
}
```

Add the table field:

```ts
  private readonly settings: Table<SettingsRow, string>
```

Bump the schema — add a `version(2)` block after the existing `version(1)` block (additive; keeps v1 stores):

```ts
    this.db.version(2).stores({
      activities: 'id, startTime',
      rawFiles: 'id',
      sectors: 'id, activityId',
      testResults: 'id, activityId',
      notes: 'activityId',
      settings: 'key',
    })
```

Assign the table alongside the others:

```ts
    this.settings = this.db.table('settings')
```

- [ ] **Step 3: Implement the two methods**

Add to the class (e.g. after `getNote`):

```ts
  async getThresholds(): Promise<Thresholds | null> {
    const row = await this.settings.get('thresholds')
    return row?.value ?? null
  }

  async saveThresholds(t: Thresholds): Promise<void> {
    await this.settings.put({ key: 'thresholds', value: t })
  }
```

- [ ] **Step 4: Run the Dexie contract test to verify it passes**

Run: `npx vitest run src/adapters/storage/dexie-library-repository.test.ts`
Expected: PASS (Date survives the round-trip via structured clone).

- [ ] **Step 5: Commit**

```bash
git add src/adapters/storage/dexie-library-repository.ts
git commit -m "feat: persist Thresholds in a Dexie settings store (schema v2)"
```

---

### Task 3: Grade-adjusted pace domain module

**Files:**
- Create: `src/domain/analysis/grade-adjusted-pace.ts`
- Test: `src/domain/analysis/grade-adjusted-pace.test.ts`

**Interfaces:**
- Consumes: `Activity`, `TimeRange`, `Series` from `../model/types`; `nearestIndex` from `../model/series`.
- Produces: `runningCost(i: number): number`; `gradeAdjustedSpeed(a: Activity, range: TimeRange): number | null` — equivalent-flat speed in m/s, `null` when distance/altitude are missing or the range has no usable distance.

- [ ] **Step 1: Write the failing test**

Create `src/domain/analysis/grade-adjusted-pace.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { makeSeries } from '../model/series'
import { syntheticActivity } from '../testing/synthetic'
import { gradeAdjustedSpeed, runningCost } from './grade-adjusted-pace'

describe('runningCost', () => {
  it('flat cost is 3.6 J/kg/m', () => {
    expect(runningCost(0)).toBeCloseTo(3.6, 6)
  })
  it('uphill costs more than flat, downhill (shallow) costs less', () => {
    expect(runningCost(0.1)).toBeGreaterThan(runningCost(0))
    expect(runningCost(-0.1)).toBeLessThan(runningCost(0))
  })
})

describe('gradeAdjustedSpeed', () => {
  it('returns null without distance or altitude', () => {
    const a = syntheticActivity({ durationS: 100 })
    expect(gradeAdjustedSpeed(a, { startS: 0, endS: 100 })).toBeNull()
  })

  it('equals real average speed on flat ground', () => {
    // 3 m/s for 300 s → distance 0..900, altitude constant.
    const t = Array.from({ length: 301 }, (_, i) => i)
    const a = syntheticActivity({
      durationS: 301,
      channels: {
        distance: makeSeries(t, t.map((s) => s * 3)),
        altitude: makeSeries(t, t.map(() => 100)),
      },
    })
    const gap = gradeAdjustedSpeed(a, { startS: 0, endS: 300 })!
    expect(gap).toBeCloseTo(3, 2)
  })

  it('slows the equivalent-flat speed on a sustained climb', () => {
    // 3 m/s horizontal, +0.1 grade (rise 0.3 m/s): uphill → GAP speed < real speed.
    const t = Array.from({ length: 301 }, (_, i) => i)
    const a = syntheticActivity({
      durationS: 301,
      channels: {
        distance: makeSeries(t, t.map((s) => s * 3)),
        altitude: makeSeries(t, t.map((s) => 100 + s * 0.3)),
      },
    })
    const gap = gradeAdjustedSpeed(a, { startS: 0, endS: 300 })!
    expect(gap).toBeLessThan(3)
    // factor = Cr(0.1)/Cr(0); equiv-flat speed ≈ 3 * that factor
    expect(gap).toBeCloseTo(3 * (runningCost(0.1) / runningCost(0)), 1)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/domain/analysis/grade-adjusted-pace.test.ts`
Expected: FAIL — module not found / `gradeAdjustedSpeed` undefined.

- [ ] **Step 3: Implement the module**

Create `src/domain/analysis/grade-adjusted-pace.ts`:

```ts
import { nearestIndex } from '../model/series'
import type { Activity, TimeRange } from '../model/types'

const SMOOTH_WINDOW_M = 30

/** Minetti et al. (2002) cost of running (J/kg/m) at gradient i (rise/run). */
export function runningCost(i: number): number {
  return 155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6
}

const FLAT_COST = runningCost(0)

/**
 * Equivalent-flat speed (m/s) over the range, adjusting for grade via the
 * Minetti cost curve. Grade is computed over ≥30 m segments to suppress GPS
 * altitude noise. Returns null when distance or altitude is missing or the
 * range carries no forward distance.
 */
export function gradeAdjustedSpeed(a: Activity, range: TimeRange): number | null {
  const dist = a.channels.distance
  const alt = a.channels.altitude
  if (!dist || !alt || dist.t.length < 2 || alt.t.length < 1) return null

  const idx: number[] = []
  for (let i = 0; i < dist.t.length; i++) {
    const ti = dist.t[i]!
    if (ti < range.startS) continue
    if (ti >= range.endS) break
    idx.push(i)
  }
  if (idx.length < 2) return null

  const altAt = (tS: number): number => alt.v[nearestIndex(alt.t, tS)]!

  let equivFlat = 0
  let j = 0
  while (j < idx.length - 1) {
    let k = j + 1
    while (k < idx.length - 1 && dist.v[idx[k]!]! - dist.v[idx[j]!]! < SMOOTH_WINDOW_M) k++
    const dDist = dist.v[idx[k]!]! - dist.v[idx[j]!]!
    if (dDist > 0) {
      const dAlt = altAt(dist.t[idx[k]!]!) - altAt(dist.t[idx[j]!]!)
      const grade = dAlt / dDist
      equivFlat += dDist * (runningCost(grade) / FLAT_COST)
    }
    j = k
  }

  const elapsed = dist.t[idx[idx.length - 1]!]! - dist.t[idx[0]!]!
  if (equivFlat <= 0 || elapsed <= 0) return null
  return equivFlat / elapsed
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/domain/analysis/grade-adjusted-pace.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/analysis/grade-adjusted-pace.ts src/domain/analysis/grade-adjusted-pace.test.ts
git commit -m "feat: grade-adjusted pace via Minetti cost curve"
```

---

### Task 4: Splits domain module

**Files:**
- Create: `src/domain/analysis/splits.ts`
- Test: `src/domain/analysis/splits.test.ts`

**Interfaces:**
- Consumes: `rangeSummary`, `ActivitySummary` from `./activity-summary`; `gradeAdjustedSpeed` from `./grade-adjusted-pace`; `Activity`, `TimeRange`, `Series` from `../model/types`.
- Produces:
  ```ts
  interface Split {
    index: number            // 0-based
    range: TimeRange
    distanceM: number        // ~1000, less for the trailing partial
    partial: boolean
    summary: ActivitySummary
    gapSpeed: number | null  // m/s; null when distance/altitude absent
    elevGainM: number | null
    elevLossM: number | null
  }
  function computeSplits(a: Activity): Split[]
  ```

- [ ] **Step 1: Write the failing test**

Create `src/domain/analysis/splits.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { makeSeries } from '../model/series'
import { syntheticActivity } from '../testing/synthetic'
import { computeSplits } from './splits'

/** 3 m/s over 900 s → 2700 m: two full km + a 700 m partial. */
function rampActivity() {
  const t = Array.from({ length: 901 }, (_, i) => i)
  return syntheticActivity({
    durationS: 901,
    channels: {
      distance: makeSeries(t, t.map((s) => s * 3)),
      heartRate: makeSeries(t, t.map(() => 150)),
      altitude: makeSeries(t, t.map(() => 100)),
    },
  })
}

describe('computeSplits', () => {
  it('returns [] without a distance channel', () => {
    const a = syntheticActivity({ durationS: 100 })
    expect(computeSplits(a)).toEqual([])
  })

  it('buckets into full km plus a flagged partial', () => {
    const splits = computeSplits(rampActivity())
    expect(splits.map((s) => s.partial)).toEqual([false, false, true])
    expect(splits[0]!.distanceM).toBeCloseTo(1000, 0)
    expect(splits[2]!.distanceM).toBeCloseTo(700, 0)
  })

  it('each split time range is ~1000/3 s except the partial', () => {
    const splits = computeSplits(rampActivity())
    expect(splits[0]!.range.endS - splits[0]!.range.startS).toBeCloseTo(1000 / 3, 0)
  })

  it('reports flat GAP equal to real speed and zero elevation', () => {
    const splits = computeSplits(rampActivity())
    expect(splits[0]!.gapSpeed!).toBeCloseTo(3, 1)
    expect(splits[0]!.elevGainM).toBe(0)
    expect(splits[0]!.elevLossM).toBe(0)
  })

  it('leaves GAP/elevation null when altitude is absent', () => {
    const t = Array.from({ length: 901 }, (_, i) => i)
    const a = syntheticActivity({
      durationS: 901,
      channels: { distance: makeSeries(t, t.map((s) => s * 3)) },
    })
    const splits = computeSplits(a)
    expect(splits[0]!.gapSpeed).toBeNull()
    expect(splits[0]!.elevGainM).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/domain/analysis/splits.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `src/domain/analysis/splits.ts`:

```ts
import { rangeSummary, type ActivitySummary } from './activity-summary'
import { gradeAdjustedSpeed } from './grade-adjusted-pace'
import type { Activity, Series, TimeRange } from '../model/types'

const SPLIT_M = 1000

export interface Split {
  index: number
  range: TimeRange
  distanceM: number
  partial: boolean
  summary: ActivitySummary
  gapSpeed: number | null
  elevGainM: number | null
  elevLossM: number | null
}

/** Time at a cumulative-distance target, linearly interpolated. dist.v is monotone non-decreasing. */
function timeAtDistance(dist: Series, target: number): number {
  const { t, v } = dist
  if (target <= v[0]!) return t[0]!
  if (target >= v[v.length - 1]!) return t[t.length - 1]!
  let lo = 0
  let hi = v.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (v[mid]! < target) lo = mid + 1
    else hi = mid
  }
  const d0 = v[lo - 1]!
  const d1 = v[lo]!
  const frac = d1 > d0 ? (target - d0) / (d1 - d0) : 0
  return t[lo - 1]! + frac * (t[lo]! - t[lo - 1]!)
}

/** Raw altitude gain/loss over a range; null when altitude is absent. */
function elevation(a: Activity, range: TimeRange): { gain: number | null; loss: number | null } {
  const alt = a.channels.altitude
  if (!alt) return { gain: null, loss: null }
  let gain = 0
  let loss = 0
  let prev: number | null = null
  for (let i = 0; i < alt.t.length; i++) {
    const ti = alt.t[i]!
    if (ti < range.startS) continue
    if (ti >= range.endS) break
    const vi = alt.v[i]!
    if (!Number.isFinite(vi)) continue
    if (prev !== null) {
      const d = vi - prev
      if (d > 0) gain += d
      else loss -= d
    }
    prev = vi
  }
  return { gain, loss }
}

export function computeSplits(a: Activity): Split[] {
  const dist = a.channels.distance
  if (!dist || dist.t.length < 2) return []
  const startDist = dist.v[0]!
  const total = dist.v[dist.v.length - 1]! - startDist
  if (total <= 0) return []

  const nSplits = Math.ceil(total / SPLIT_M)
  const splits: Split[] = []
  for (let i = 0; i < nSplits; i++) {
    const dLo = startDist + i * SPLIT_M
    const dHi = Math.min(startDist + (i + 1) * SPLIT_M, startDist + total)
    const range: TimeRange = { startS: timeAtDistance(dist, dLo), endS: timeAtDistance(dist, dHi) }
    const distanceM = dHi - dLo
    const elev = elevation(a, range)
    splits.push({
      index: i,
      range,
      distanceM,
      partial: distanceM < SPLIT_M - 0.5,
      summary: rangeSummary(a, range),
      gapSpeed: gradeAdjustedSpeed(a, range),
      elevGainM: elev.gain,
      elevLossM: elev.loss,
    })
  }
  return splits
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/domain/analysis/splits.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/analysis/splits.ts src/domain/analysis/splits.test.ts
git commit -m "feat: per-km split breakdown with GAP and elevation"
```

---

### Task 5: Zones domain module + threshold resolution

**Files:**
- Create: `src/domain/analysis/zones.ts`
- Test: `src/domain/analysis/zones.test.ts`

**Interfaces:**
- Consumes: `nonExcludedRange` from `../model/series`; `GAP_THRESHOLD_S` from `./protocol-constants`; `Activity`, `AetTestResult`, `AntTestResult`, `TestResult`, `Thresholds` from `../model/types`.
- Produces:
  ```ts
  function resolveThresholds(
    activityId: string,
    global: Thresholds | null,
    tests: TestResult[],
  ): { aetHr: number | null; antHr: number | null }

  type ZoneResult =
    | { ok: true; aetHr: number; antHr: number; belowAetS: number; aetToAntS: number; aboveAntS: number; totalS: number }
    | { ok: false; reason: 'no-hr' | 'no-thresholds' | 'invalid-order' }

  function computeZones(a: Activity, resolved: { aetHr: number | null; antHr: number | null }): ZoneResult
  ```

- [ ] **Step 1: Write the failing test**

Create `src/domain/analysis/zones.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { makeSeries } from '../model/series'
import { syntheticActivity } from '../testing/synthetic'
import type { AetTestResult, AntTestResult } from '../model/types'
import { computeZones, resolveThresholds } from './zones'

const aetTest: AetTestResult = {
  kind: 'aet', id: 't-aet', activityId: 'run1', testDate: new Date('2026-07-01T08:00:00Z'),
  createdAt: new Date('2026-07-01T10:00:00Z'), window: { startS: 0, endS: 3600 },
  pace: null, power: null, windowAvgHr: 150, aetHr: 150,
}
const antTest: AntTestResult = {
  kind: 'ant', id: 't-ant', activityId: 'run1', testDate: new Date('2026-07-01T08:00:00Z'),
  createdAt: new Date('2026-07-01T10:00:00Z'), window: { startS: 0, endS: 3600 },
  antHr: 172, windowAvgHr: 170, windowAvgSpeed: null, windowAvgPower: null,
}

describe('resolveThresholds', () => {
  it('uses the global value when no test on the run', () => {
    const g = { aetHr: 145, antHr: 168, updatedAt: new Date('2026-07-06T00:00:00Z') }
    expect(resolveThresholds('run1', g, [])).toEqual({ aetHr: 145, antHr: 168 })
  })
  it("a saved test on the run overrides the global", () => {
    const g = { aetHr: 145, antHr: 168, updatedAt: new Date('2026-07-06T00:00:00Z') }
    expect(resolveThresholds('run1', g, [aetTest, antTest])).toEqual({ aetHr: 150, antHr: 172 })
  })
  it('a test on a different run does not override', () => {
    const g = { aetHr: 145, antHr: 168, updatedAt: new Date('2026-07-06T00:00:00Z') }
    expect(resolveThresholds('other', g, [aetTest])).toEqual({ aetHr: 145, antHr: 168 })
  })
  it('null global with no test yields nulls', () => {
    expect(resolveThresholds('run1', null, [])).toEqual({ aetHr: null, antHr: null })
  })
})

describe('computeZones', () => {
  const hr = (val: (s: number) => number) =>
    syntheticActivity({ durationS: 300, channels: { heartRate: makeSeries(
      Array.from({ length: 300 }, (_, i) => i), Array.from({ length: 300 }, (_, i) => val(i)),
    ) } })

  it('errors without HR', () => {
    const a = syntheticActivity({ durationS: 300 })
    expect(computeZones(a, { aetHr: 140, antHr: 160 })).toEqual({ ok: false, reason: 'no-hr' })
  })
  it('errors without thresholds', () => {
    expect(computeZones(hr(() => 150), { aetHr: null, antHr: 160 })).toEqual({ ok: false, reason: 'no-thresholds' })
  })
  it('errors when aet >= ant', () => {
    expect(computeZones(hr(() => 150), { aetHr: 160, antHr: 150 })).toEqual({ ok: false, reason: 'invalid-order' })
  })
  it('partitions time across three zones', () => {
    // 0..99 → 130 (below), 100..199 → 155 (mid), 200..299 → 175 (above); 100 samples × 1 s each.
    const a = hr((s) => (s < 100 ? 130 : s < 200 ? 155 : 175))
    const r = computeZones(a, { aetHr: 140, antHr: 170 })
    if (!r.ok) throw new Error('expected ok')
    expect(r.belowAetS).toBeCloseTo(100, 0)
    expect(r.aetToAntS).toBeCloseTo(100, 0)
    expect(r.aboveAntS).toBeCloseTo(100, 0)
    expect(r.totalS).toBeCloseTo(300, 0)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/domain/analysis/zones.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `src/domain/analysis/zones.ts`:

```ts
import { nonExcludedRange } from '../model/series'
import type {
  Activity,
  AetTestResult,
  AntTestResult,
  TestResult,
  Thresholds,
} from '../model/types'
import { GAP_THRESHOLD_S } from './protocol-constants'

export type ZoneResult =
  | {
      ok: true
      aetHr: number
      antHr: number
      belowAetS: number
      aetToAntS: number
      aboveAntS: number
      totalS: number
    }
  | { ok: false; reason: 'no-hr' | 'no-thresholds' | 'invalid-order' }

/** Resolve a run's thresholds: a saved test on the run wins, else the global value. */
export function resolveThresholds(
  activityId: string,
  global: Thresholds | null,
  tests: TestResult[],
): { aetHr: number | null; antHr: number | null } {
  const aetTest = tests.find(
    (t): t is AetTestResult => t.kind === 'aet' && t.activityId === activityId && t.aetHr !== null,
  )
  const antTest = tests.find(
    (t): t is AntTestResult => t.kind === 'ant' && t.activityId === activityId,
  )
  return {
    aetHr: aetTest?.aetHr ?? global?.aetHr ?? null,
    antHr: antTest?.antHr ?? global?.antHr ?? null,
  }
}

/** Sample-weighted seconds in each HR zone over the non-excluded range. */
export function computeZones(
  a: Activity,
  resolved: { aetHr: number | null; antHr: number | null },
): ZoneResult {
  const hr = a.channels.heartRate
  if (!hr || hr.t.length === 0) return { ok: false, reason: 'no-hr' }
  const { aetHr, antHr } = resolved
  if (aetHr === null || antHr === null) return { ok: false, reason: 'no-thresholds' }
  if (aetHr >= antHr) return { ok: false, reason: 'invalid-order' }

  const range = nonExcludedRange(a)
  const { t, v } = hr
  const n = t.length
  let below = 0
  let mid = 0
  let above = 0
  for (let i = 0; i < n; i++) {
    const ti = t[i]!
    if (ti < range.startS) continue
    if (ti >= range.endS) break
    const vi = v[i]!
    if (!Number.isFinite(vi)) continue
    const next = i + 1 < n ? t[i + 1]! : range.endS
    const rawDelta = next - ti
    if (rawDelta > GAP_THRESHOLD_S) continue
    const span = Math.min(rawDelta, range.endS - ti)
    if (vi < aetHr) below += span
    else if (vi < antHr) mid += span
    else above += span
  }
  return { ok: true, aetHr, antHr, belowAetS: below, aetToAntS: mid, aboveAntS: above, totalS: below + mid + above }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/domain/analysis/zones.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/analysis/zones.ts src/domain/analysis/zones.test.ts
git commit -m "feat: HR time-in-zone with saved-test-over-global threshold resolution"
```

---

### Task 6: `useThresholds` hook

**Files:**
- Modify: `src/app/hooks.ts`

**Interfaces:**
- Consumes: `getThresholds`/`saveThresholds` (Tasks 1–2), `Thresholds` type.
- Produces: `useThresholds(): { thresholds: Thresholds | null; save(aetHr: number | null, antHr: number | null): Promise<void>; refresh(): void }`.

- [ ] **Step 1: Implement the hook**

In `src/app/hooks.ts`, extend the type import and append the hook:

```ts
import type { Activity, TestResult, Thresholds } from '../domain/model/types'
```

```ts
export function useThresholds() {
  const { repo } = useContainer()
  const [thresholds, setThresholds] = useState<Thresholds | null>(null)
  const refresh = useCallback(() => {
    void repo.getThresholds().then(setThresholds)
  }, [repo])
  useEffect(refresh, [refresh])
  const save = useCallback(
    async (aetHr: number | null, antHr: number | null) => {
      const t: Thresholds = { aetHr, antHr, updatedAt: new Date() }
      await repo.saveThresholds(t)
      setThresholds(t)
    },
    [repo],
  )
  return { thresholds, save, refresh }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/hooks.ts
git commit -m "feat: useThresholds hook over the repository singleton"
```

---

### Task 7: Splits panel + wire into the activity screen

**Files:**
- Create: `src/app/screens/activity/splits-panel.tsx`
- Test: `src/app/screens/activity/splits-panel.test.tsx`
- Modify: `src/app/screens/activity/activity-screen.tsx`

**Interfaces:**
- Consumes: `computeSplits`, `Split` (Task 4); `formatBpm`, `formatDistanceKm`, `formatDuration`, `formatPace` from `../../format`.
- Produces: `SplitsPanel({ activity }: { activity: Activity })`.

- [ ] **Step 1: Write the failing test**

Create `src/app/screens/activity/splits-panel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeSeries } from '../../../domain/model/series'
import { syntheticActivity } from '../../../domain/testing/synthetic'
import { SplitsPanel } from './splits-panel'

function ramp() {
  const t = Array.from({ length: 901 }, (_, i) => i)
  return syntheticActivity({
    durationS: 901,
    channels: {
      distance: makeSeries(t, t.map((s) => s * 3)),
      heartRate: makeSeries(t, t.map(() => 150)),
      altitude: makeSeries(t, t.map(() => 100)),
    },
  })
}

describe('SplitsPanel', () => {
  it('renders a row per split with a partial tag on the last', () => {
    render(<SplitsPanel activity={ramp()} />)
    expect(screen.getByText('Splits')).toBeInTheDocument()
    expect(screen.getByText('partial')).toBeInTheDocument()
    // full splits render a clean km label; the partial row's cell is "3partial".
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders nothing without a distance channel', () => {
    const { container } = render(<SplitsPanel activity={syntheticActivity({ durationS: 100 })} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/screens/activity/splits-panel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the panel**

Create `src/app/screens/activity/splits-panel.tsx`:

```tsx
import { computeSplits } from '../../../domain/analysis/splits'
import type { Activity } from '../../../domain/model/types'
import { formatBpm, formatDistanceKm, formatDuration, formatPace } from '../../format'

export function SplitsPanel({ activity }: { activity: Activity }) {
  const splits = computeSplits(activity)
  if (splits.length === 0) return null

  return (
    <section>
      <h3 className="mb-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">Splits</h3>
      <table className="w-full border-collapse font-mono text-sm tabular-nums">
        <thead>
          <tr className="border-b border-line text-left text-[10px] uppercase tracking-widest text-ink-muted">
            <th className="py-1 pr-3 font-medium">km</th>
            <th className="py-1 pr-3 font-medium">time</th>
            <th className="py-1 pr-3 font-medium">pace</th>
            <th className="py-1 pr-3 font-medium">gap</th>
            <th className="py-1 pr-3 font-medium">hr</th>
            <th className="py-1 font-medium">elev</th>
          </tr>
        </thead>
        <tbody>
          {splits.map((s) => (
            <tr key={s.index} className="border-b border-line/40">
              <td className="py-1 pr-3 text-ink-muted">
                {s.index + 1}
                {s.partial && <span className="ml-1 text-caution">partial</span>}
              </td>
              <td className="py-1 pr-3">{formatDuration(s.range.endS - s.range.startS)}</td>
              <td className="py-1 pr-3 text-ch-pace">
                {s.summary.avgSpeed === null ? '–' : formatPace(s.summary.avgSpeed)}
              </td>
              <td className="py-1 pr-3 text-ch-pace">
                {s.gapSpeed === null ? '–' : formatPace(s.gapSpeed)}
              </td>
              <td className="py-1 pr-3 text-ch-hr">{formatBpm(s.summary.avgHr)}</td>
              <td className="py-1">
                {s.elevGainM === null
                  ? '–'
                  : `+${Math.round(s.elevGainM)}/−${Math.round(s.elevLossM ?? 0)} m`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/app/screens/activity/splits-panel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire into the activity screen**

In `src/app/screens/activity/activity-screen.tsx`, add the import near the other panel imports:

```ts
import { SplitsPanel } from './splits-panel'
```

In the `Workspace` render, add the panel right after `<LapTable activity={activity} />`:

```tsx
          <LapTable activity={activity} />
          <SplitsPanel activity={activity} />
```

- [ ] **Step 6: Typecheck + full test run**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/screens/activity/splits-panel.tsx src/app/screens/activity/splits-panel.test.tsx src/app/screens/activity/activity-screen.tsx
git commit -m "feat: splits panel on the activity screen"
```

---

### Task 8: Zones panel + inline thresholds editor + wire

**Files:**
- Create: `src/app/screens/activity/zones-panel.tsx`
- Test: `src/app/screens/activity/zones-panel.test.tsx`
- Modify: `src/app/screens/activity/activity-screen.tsx`

**Interfaces:**
- Consumes: `computeZones`, `resolveThresholds`, `ZoneResult` (Task 5); `Thresholds`, `TestResult`, `Activity` types; `formatDuration` from `../../format`.
- Produces:
  ```tsx
  ZonesPanel({
    activity, thresholds, tests, onSave,
  }: {
    activity: Activity
    thresholds: Thresholds | null
    tests: TestResult[]
    onSave: (aetHr: number | null, antHr: number | null) => void | Promise<void>
  })
  ```

- [ ] **Step 1: Write the failing test**

Create `src/app/screens/activity/zones-panel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeSeries } from '../../../domain/model/series'
import { syntheticActivity } from '../../../domain/testing/synthetic'
import { ZonesPanel } from './zones-panel'

function hrActivity() {
  const t = Array.from({ length: 300 }, (_, i) => i)
  return syntheticActivity({
    durationS: 300,
    channels: { heartRate: makeSeries(t, t.map((s) => (s < 150 ? 130 : 175))) },
  })
}

describe('ZonesPanel', () => {
  it('prompts for thresholds when none are resolved', () => {
    render(<ZonesPanel activity={hrActivity()} thresholds={null} tests={[]} onSave={() => {}} />)
    expect(screen.getByText(/set your thresholds/i)).toBeInTheDocument()
  })

  it('draws the bar when thresholds resolve', () => {
    const thresholds = { aetHr: 140, antHr: 170, updatedAt: new Date('2026-07-06T00:00:00Z') }
    render(<ZonesPanel activity={hrActivity()} thresholds={thresholds} tests={[]} onSave={() => {}} />)
    expect(screen.getByText('Below AeT')).toBeInTheDocument()
    expect(screen.getByText('Above AnT')).toBeInTheDocument()
  })

  it('saves edited thresholds', async () => {
    const onSave = vi.fn()
    render(<ZonesPanel activity={hrActivity()} thresholds={null} tests={[]} onSave={onSave} />)
    await userEvent.type(screen.getByTestId('aet-input'), '145')
    await userEvent.type(screen.getByTestId('ant-input'), '168')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith(145, 168)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/screens/activity/zones-panel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the panel**

Create `src/app/screens/activity/zones-panel.tsx`:

```tsx
import { useState } from 'react'
import { computeZones, resolveThresholds } from '../../../domain/analysis/zones'
import type { Activity, TestResult, Thresholds } from '../../../domain/model/types'
import { formatDuration } from '../../format'

const ZONE_COLORS = { below: '#4cc9f0', mid: '#ffc53d', above: '#ff6b6b' }

export function ZonesPanel({
  activity,
  thresholds,
  tests,
  onSave,
}: {
  activity: Activity
  thresholds: Thresholds | null
  tests: TestResult[]
  onSave: (aetHr: number | null, antHr: number | null) => void | Promise<void>
}) {
  const resolved = resolveThresholds(activity.id, thresholds, tests)
  const zones = computeZones(activity, resolved)

  return (
    <section>
      <h3 className="mb-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">Zones</h3>
      {zones.ok ? (
        <ZoneBar zones={zones} />
      ) : (
        <p className="mb-2 font-mono text-xs text-ink-muted">
          {zones.reason === 'no-hr'
            ? 'No heart-rate data on this run.'
            : zones.reason === 'invalid-order'
              ? 'AeT must be below AnT.'
              : 'Set your thresholds to see time-in-zone.'}
        </p>
      )}
      {(zones.ok || zones.reason !== 'no-hr') && (
        <ThresholdEditor aet={resolved.aetHr} ant={resolved.antHr} onSave={onSave} />
      )}
    </section>
  )
}

function ZoneBar({
  zones,
}: {
  zones: Extract<ReturnType<typeof computeZones>, { ok: true }>
}) {
  const total = zones.totalS || 1
  const rows = [
    { label: 'Below AeT', s: zones.belowAetS, color: ZONE_COLORS.below },
    { label: `AeT–AnT`, s: zones.aetToAntS, color: ZONE_COLORS.mid },
    { label: 'Above AnT', s: zones.aboveAntS, color: ZONE_COLORS.above },
  ]
  return (
    <div className="mb-3">
      <div className="mb-2 flex h-3 overflow-hidden rounded">
        {rows.map((r) => (
          <div key={r.label} style={{ width: `${(r.s / total) * 100}%`, background: r.color }} />
        ))}
      </div>
      <table className="w-full font-mono text-sm tabular-nums">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="py-0.5 pr-3">
                <span
                  className="mr-2 inline-block h-2 w-2 rounded-sm align-middle"
                  style={{ background: r.color }}
                />
                {r.label}
              </td>
              <td className="py-0.5 pr-3 text-right">{formatDuration(r.s)}</td>
              <td className="py-0.5 text-right text-ink-muted">
                {Math.round((r.s / total) * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ThresholdEditor({
  aet,
  ant,
  onSave,
}: {
  aet: number | null
  ant: number | null
  onSave: (aetHr: number | null, antHr: number | null) => void | Promise<void>
}) {
  const [aetStr, setAetStr] = useState(aet === null ? '' : String(aet))
  const [antStr, setAntStr] = useState(ant === null ? '' : String(ant))
  const parse = (s: string): number | null => {
    const n = Number.parseInt(s, 10)
    return Number.isFinite(n) ? n : null
  }
  return (
    <div className="flex items-end gap-2 font-mono text-xs">
      <label className="flex flex-col gap-1 text-ink-muted">
        AeT
        <input
          data-testid="aet-input"
          className="w-16 rounded border border-line bg-surface px-2 py-1 text-ink tabular-nums"
          value={aetStr}
          onChange={(e) => setAetStr(e.target.value)}
          inputMode="numeric"
        />
      </label>
      <label className="flex flex-col gap-1 text-ink-muted">
        AnT
        <input
          data-testid="ant-input"
          className="w-16 rounded border border-line bg-surface px-2 py-1 text-ink tabular-nums"
          value={antStr}
          onChange={(e) => setAntStr(e.target.value)}
          inputMode="numeric"
        />
      </label>
      <button
        type="button"
        className="rounded border border-line bg-surface px-3 py-1 text-ink hover:bg-line/30"
        onClick={() => void onSave(parse(aetStr), parse(antStr))}
      >
        Save
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/app/screens/activity/zones-panel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire into the activity screen**

In `src/app/screens/activity/activity-screen.tsx`:

Add imports:

```ts
import { ZonesPanel } from './zones-panel'
import { useThresholds } from '../../hooks'
```

(Extend the existing `useTestResults` import line if it shares a statement — `useThresholds` is exported from the same `../../hooks` module.)

Inside `Workspace`, near `const { results, refresh: refreshResults } = useTestResults()`, add:

```ts
  const { thresholds, save: saveThresholds } = useThresholds()
```

Render the panel after `<SplitsPanel activity={activity} />`:

```tsx
          <SplitsPanel activity={activity} />
          <ZonesPanel
            activity={activity}
            thresholds={thresholds}
            tests={activityTests}
            onSave={saveThresholds}
          />
```

(`activityTests` already exists in `Workspace`: `results.filter((r) => r.activityId === activity.id)`.)

- [ ] **Step 6: Typecheck + full test run**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/screens/activity/zones-panel.tsx src/app/screens/activity/zones-panel.test.tsx src/app/screens/activity/activity-screen.tsx
git commit -m "feat: HR zones panel with inline thresholds editor"
```

---

### Task 9: GAP summary line in StatsPanel

**Files:**
- Modify: `src/app/screens/activity/stats-panel.tsx`
- Test: `src/app/screens/activity/stats-panel.test.tsx`

**Interfaces:**
- Consumes: `gradeAdjustedSpeed` (Task 3); `formatPace` from `../../format`.

- [ ] **Step 1: Write the failing test**

Add to `src/app/screens/activity/stats-panel.test.tsx` a test that a run with distance + altitude renders a "GAP" label. If the file's setup helper lacks distance/altitude, build a local activity:

```tsx
import { makeSeries } from '../../../domain/model/series'

it('shows a GAP pace line when distance and altitude are present', () => {
  const t = Array.from({ length: 301 }, (_, i) => i)
  const a = syntheticActivity({
    durationS: 301,
    channels: {
      distance: makeSeries(t, t.map((s) => s * 3)),
      altitude: makeSeries(t, t.map(() => 100)),
      heartRate: makeSeries(t, t.map(() => 150)),
    },
  })
  render(<StatsPanel activity={a} sectors={[]} exclusions={a.exclusions} selectedSectorId={null} />)
  expect(screen.getByText('GAP')).toBeInTheDocument()
})
```

(Match the existing imports in the test file — `render`, `screen`, `syntheticActivity`, `StatsPanel`. Add `makeSeries` if absent.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/screens/activity/stats-panel.test.tsx`
Expected: FAIL — no "GAP" text.

- [ ] **Step 3: Implement the GAP line**

In `src/app/screens/activity/stats-panel.tsx`, add imports:

```ts
import { gradeAdjustedSpeed } from '../../../domain/analysis/grade-adjusted-pace'
import { formatPace } from '../../format'
```

In `StatsPanel`, compute the whole-run GAP and render it under the whole-run table (inside the same `<section>`, after `</table>`):

```tsx
        {(() => {
          const gap = gradeAdjustedSpeed(activity, whole)
          return gap === null ? null : (
            <p className="mt-2 flex justify-between text-[10px] uppercase tracking-widest text-ink-muted">
              <span>GAP</span>
              <span className="tabular-nums text-ch-pace">{formatPace(gap)}</span>
            </p>
          )
        })()}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/app/screens/activity/stats-panel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/screens/activity/stats-panel.tsx src/app/screens/activity/stats-panel.test.tsx
git commit -m "feat: whole-run GAP pace in the stats panel"
```

---

### Task 10: End-to-end zones journey

**Files:**
- Modify: `e2e/core-journeys.spec.ts`

**Interfaces:**
- Consumes: the `aet-input` / `ant-input` test IDs and the "Save" button from Task 8; the existing `openRun` helper.

- [ ] **Step 1: Add the failing e2e test**

In `e2e/core-journeys.spec.ts`, append:

```ts
test('setting thresholds populates the zones bar', async ({ page }) => {
  await openRun(page)
  // Before thresholds: the prompt is shown.
  await expect(page.getByText(/set your thresholds/i)).toBeVisible()
  await page.getByTestId('aet-input').fill('145')
  await page.getByTestId('ant-input').fill('170')
  await page.getByRole('button', { name: 'Save' }).click()
  // After saving: the zone legend appears.
  await expect(page.getByText('Below AeT')).toBeVisible()
  await expect(page.getByText('Above AnT')).toBeVisible()
})
```

- [ ] **Step 2: Run it to verify it passes**

Run: `npx playwright test e2e/core-journeys.spec.ts -g "zones bar"`
Expected: PASS. (The fixture `user-run-2026-07-05.fit` has HR, so zones resolve once thresholds are set. If the fixture's HR range never crosses 145/170, adjust the values so all three zones are plausibly non-empty — the legend labels render regardless of segment width.)

- [ ] **Step 3: Full suite gate**

Run: `npx vitest run && npx tsc --noEmit && npx playwright test`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add e2e/core-journeys.spec.ts
git commit -m "test(e2e): set thresholds and see the zones bar populate"
```

---

## Self-Review Notes

- **Spec coverage:** Thresholds singleton + persistence (Tasks 1–2); resolution rule (Task 5 `resolveThresholds`); GAP/Minetti (Task 3); splits with GAP + elevation + partial flag + no-distance→empty (Task 4); zones over non-excluded range with all three guards (Task 5); splits panel (Task 7); zones panel + inline editor + unresolved prompt (Task 8); GAP summary stat (Task 9); e2e (Task 10). All spec sections map to a task.
- **Type consistency:** `gradeAdjustedSpeed` (m/s) used identically in Tasks 3/4/9; `Split` shape defined in Task 4 and consumed in Task 7; `ZoneResult`/`resolveThresholds` defined in Task 5 and consumed in Task 8; `Thresholds` defined in Task 1 and threaded through 2/6/8.
- **Note for the implementer:** raw altitude gain/loss (Task 4 `elevation`) is unsmoothed — acceptable for v1 per the spec's YAGNI stance; if fixture elevation looks inflated later, add a small hysteresis threshold, out of scope here.
