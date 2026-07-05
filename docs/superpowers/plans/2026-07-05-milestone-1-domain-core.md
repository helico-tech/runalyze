# Milestone 1: Toolchain Scaffold + Domain Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Vite/React/TS toolchain and implement the complete pure-TypeScript physiology engine (stats, decoupling, AeT/AnT protocols, ADS assessment, window suggestion) with a green Vitest suite.

**Architecture:** Ports & adapters per the spec (`docs/superpowers/specs/2026-07-05-run-analysis-tool-design.md`). This milestone builds only `src/domain/` — pure TypeScript, no React/DOM/Dexie/Garmin-SDK imports — plus the project scaffold. Adapters and UI come in later milestone plans.

**Tech Stack:** Vite, React 19, TypeScript (strict), Vitest, ESLint (typescript-eslint, react-hooks), Prettier.

## Milestone map (later plans, authored after each milestone lands)

2. FIT & storage adapters: `@garmin/fitsdk` + `fflate` parser adapter, Dexie `LibraryRepository`, fixtures + `fixtures-manifest.md`.
3. App shell + import pipeline + Library screen (Tailwind v4 + shadcn arrive here).
4. Workspace: uPlot wrapper + overlay plugins, channel rail, sectors, trims, stats panel, notes.
5. Test side panels (AeT/AnT), ADS card, Trends screen.
6. Export cards + full Playwright E2E + polish.

## Global Constraints

- Node ≥ 20.19 (Vite 7 requirement); npm as package manager.
- TypeScript strict: `"strict": true` plus `"noUncheckedIndexedAccess": true` — index access needs `!` or guards.
- `src/domain/**` must not import from React, the DOM, Dexie, or the Garmin SDK. Ever.
- Every protocol threshold lives in `src/domain/analysis/protocol-constants.ts` — no magic numbers elsewhere. Values (from spec §2): `GAP_THRESHOLD_S=60`, `MAX_GAP_IN_WINDOW_S=120`, `AET_MIN_WINDOW_S=2700`, `AET_TARGET_WINDOW_S=3600`, `AET_DECOUPLING_AT_MIN=3.5`, `AET_DECOUPLING_AT_MAX=5.0`, `ANT_MIN_WINDOW_S=1800`, `ANT_AVG_SPAN_S=1200`, `ADS_GAP_THRESHOLD_PCT=10`, `TEST_STALE_DAYS=90`, `WINDOW_SUGGESTION_STEP_S=30`.
- SI units internally: m/s, W, bpm, m, seconds relative to activity start.
- Time ranges are half-open: a sample at `t` is inside `{startS, endS}` iff `startS ≤ t < endS`.
- TDD: write the failing test, watch it fail, implement, watch it pass, commit. Unit tests colocated (`foo.test.ts` next to `foo.ts`).
- Commit style: `feat(domain): …` / `chore: …`, one commit per task minimum.

---

### Task 1: Toolchain scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.gitignore`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/scaffold.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: working `npm run dev|build|test|lint` scripts. `src/scaffold.test.ts` is temporary; Task 2 deletes it.

- [x] **Step 1: Write config and entry files**

`.gitignore`:

```
node_modules
dist
coverage
```

`package.json` (versions land via `npm install` in Step 2):

```json
{
  "name": "runalyze",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "format": "prettier --write ."
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

`vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

`eslint.config.js`:

```js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
)
```

`.prettierrc.json`:

```json
{ "printWidth": 100, "singleQuote": true, "semi": false }
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Runalyze</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/App.tsx`:

```tsx
export function App() {
  return <h1>Runalyze</h1>
}
```

`src/scaffold.test.ts` (temporary — Task 2 deletes it):

```ts
import { describe, expect, it } from 'vitest'

describe('scaffold', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [x] **Step 2: Install dependencies**

Run:

```bash
npm install react react-dom
npm install -D typescript vite @vitejs/plugin-react vitest @types/react @types/react-dom eslint @eslint/js typescript-eslint eslint-plugin-react-hooks globals prettier
```

Expected: both commands exit 0, `package-lock.json` created.

- [x] **Step 3: Verify the toolchain**

Run: `npm test` → Expected: 1 passed test (`scaffold`).
Run: `npm run lint` → Expected: exit 0, no errors.
Run: `npm run build` → Expected: `dist/` produced, exit 0.

- [x] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS strict + Vitest + ESLint/Prettier toolchain"
```

---

### Task 2: Domain model — types, series, range helpers

**Files:**
- Create: `src/domain/model/types.ts`, `src/domain/model/series.ts`, `src/domain/model/series.test.ts`, `src/domain/testing/synthetic.ts`
- Delete: `src/scaffold.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (used by every later task):
  - Types: `ChannelKind`, `Series {t: Float64Array; v: Float64Array}`, `TimeRange {startS; endS}`, `Exclusions {warmupEndS; cooldownStartS}`, `Activity`, `Sector`, `DriftChannel`, `AetVerdict`, `AetTestResult`, `AntTestResult`, `TestResult`, `Note`
  - `makeSeries(t: ArrayLike<number>, v: ArrayLike<number>): Series` — throws on length mismatch / non-increasing timestamps
  - `rangeLengthS(r: TimeRange): number`
  - `defaultExclusions(durationS: number): Exclusions`
  - `nonExcludedRange(a: Activity): TimeRange`
  - `overlapsExclusion(a: Activity, w: TimeRange): boolean`
  - Test helpers: `syntheticSeries(opts): Series`, `syntheticActivity(opts): Activity`

- [x] **Step 1: Write the failing tests**

`src/domain/model/series.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  defaultExclusions,
  makeSeries,
  nonExcludedRange,
  overlapsExclusion,
  rangeLengthS,
} from './series'
import { syntheticActivity } from '../testing/synthetic'

describe('makeSeries', () => {
  it('builds Float64Array series from number arrays', () => {
    const s = makeSeries([0, 1, 2], [10, 11, 12])
    expect(s.t).toBeInstanceOf(Float64Array)
    expect(s.v).toBeInstanceOf(Float64Array)
    expect(Array.from(s.t)).toEqual([0, 1, 2])
    expect(Array.from(s.v)).toEqual([10, 11, 12])
  })

  it('allows an empty series', () => {
    const s = makeSeries([], [])
    expect(s.t.length).toBe(0)
  })

  it('throws on length mismatch', () => {
    expect(() => makeSeries([0, 1], [10])).toThrow(/equal length/)
  })

  it('throws on non-increasing timestamps', () => {
    expect(() => makeSeries([0, 2, 2], [1, 2, 3])).toThrow(/strictly increasing/)
    expect(() => makeSeries([0, 2, 1], [1, 2, 3])).toThrow(/strictly increasing/)
  })
})

describe('range helpers', () => {
  it('rangeLengthS', () => {
    expect(rangeLengthS({ startS: 100, endS: 700 })).toBe(600)
  })

  it('defaultExclusions excludes nothing', () => {
    expect(defaultExclusions(3600)).toEqual({ warmupEndS: 0, cooldownStartS: 3600 })
  })

  it('nonExcludedRange reflects trims', () => {
    const a = syntheticActivity({
      durationS: 5400,
      exclusions: { warmupEndS: 600, cooldownStartS: 5100 },
    })
    expect(nonExcludedRange(a)).toEqual({ startS: 600, endS: 5100 })
  })

  it('overlapsExclusion detects warmup and cooldown overlap', () => {
    const a = syntheticActivity({
      durationS: 5400,
      exclusions: { warmupEndS: 600, cooldownStartS: 5100 },
    })
    expect(overlapsExclusion(a, { startS: 300, endS: 3900 })).toBe(true)
    expect(overlapsExclusion(a, { startS: 900, endS: 5200 })).toBe(true)
    expect(overlapsExclusion(a, { startS: 600, endS: 5100 })).toBe(false)
    expect(overlapsExclusion(a, { startS: 900, endS: 4500 })).toBe(false)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./series` / `../testing/synthetic`.

- [x] **Step 3: Implement**

`src/domain/model/types.ts`:

```ts
export type ChannelKind =
  | 'heartRate'
  | 'speed'
  | 'power'
  | 'cadence'
  | 'altitude'
  | 'distance'
  | 'temperature'

export interface Series {
  /** seconds relative to activity start, strictly increasing */
  t: Float64Array
  v: Float64Array
}

/** Half-open: a sample at time t is inside iff startS <= t < endS */
export interface TimeRange {
  startS: number
  endS: number
}

export interface Exclusions {
  warmupEndS: number
  cooldownStartS: number
}

export interface Activity {
  /** content hash of the source file */
  id: string
  startTime: Date
  durationS: number
  sport: string
  device: string | null
  channels: Partial<Record<ChannelKind, Series>>
  exclusions: Exclusions
}

export interface Sector {
  id: string
  activityId: string
  range: TimeRange
  label: string
  kind: 'sector' | 'test-window'
}

export type DriftChannel = 'speed' | 'power'

export type AetVerdict = 'above-aet' | 'at-aet' | 'below-aet'

export interface AetTestResult {
  kind: 'aet'
  id: string
  activityId: string
  testDate: Date
  createdAt: Date
  window: TimeRange
  driftChannel: DriftChannel
  decouplingPct: number
  windowAvgHr: number
  verdict: AetVerdict
  /** set when verdict is at-aet, or when the user explicitly accepted; integer bpm */
  aetHr: number | null
}

export interface AntTestResult {
  kind: 'ant'
  id: string
  activityId: string
  testDate: Date
  createdAt: Date
  window: TimeRange
  /** integer bpm */
  antHr: number
  windowAvgHr: number
  /** informational, sample-weighted over the window; null when the channel is absent or empty */
  windowAvgSpeed: number | null
  windowAvgPower: number | null
}

export type TestResult = AetTestResult | AntTestResult

export interface Note {
  activityId: string
  text: string
  updatedAt: Date
}
```

`src/domain/model/series.ts`:

```ts
import type { Activity, Exclusions, Series, TimeRange } from './types'

export function makeSeries(t: ArrayLike<number>, v: ArrayLike<number>): Series {
  if (t.length !== v.length) {
    throw new Error(`series arrays must have equal length (got ${t.length} and ${v.length})`)
  }
  const tArr = Float64Array.from(t)
  for (let i = 1; i < tArr.length; i++) {
    if (tArr[i]! <= tArr[i - 1]!) {
      throw new Error(`series timestamps must be strictly increasing (index ${i})`)
    }
  }
  return { t: tArr, v: Float64Array.from(v) }
}

export function rangeLengthS(r: TimeRange): number {
  return r.endS - r.startS
}

export function defaultExclusions(durationS: number): Exclusions {
  return { warmupEndS: 0, cooldownStartS: durationS }
}

export function nonExcludedRange(a: Activity): TimeRange {
  return { startS: a.exclusions.warmupEndS, endS: a.exclusions.cooldownStartS }
}

export function overlapsExclusion(a: Activity, w: TimeRange): boolean {
  return w.startS < a.exclusions.warmupEndS || w.endS > a.exclusions.cooldownStartS
}
```

`src/domain/testing/synthetic.ts`:

```ts
import { defaultExclusions, makeSeries } from '../model/series'
import type { Activity, ChannelKind, Exclusions, Series } from '../model/types'

export interface SyntheticSeriesOpts {
  durationS: number
  /** sample interval, default 1s */
  dtS?: number
  /** first sample time, default 0 */
  startS?: number
  value: (tS: number) => number
}

export function syntheticSeries(opts: SyntheticSeriesOpts): Series {
  const dt = opts.dtS ?? 1
  const start = opts.startS ?? 0
  const t: number[] = []
  const v: number[] = []
  for (let ts = start; ts < start + opts.durationS; ts += dt) {
    t.push(ts)
    v.push(opts.value(ts))
  }
  return makeSeries(t, v)
}

export interface SyntheticActivityOpts {
  durationS: number
  channels?: Partial<Record<ChannelKind, Series>>
  exclusions?: Exclusions
  id?: string
  startTime?: Date
}

export function syntheticActivity(opts: SyntheticActivityOpts): Activity {
  return {
    id: opts.id ?? 'test-activity',
    startTime: opts.startTime ?? new Date('2026-07-01T08:00:00Z'),
    durationS: opts.durationS,
    sport: 'running',
    device: null,
    channels: opts.channels ?? {},
    exclusions: opts.exclusions ?? defaultExclusions(opts.durationS),
  }
}
```

- [x] **Step 4: Delete the scaffold smoke test**

```bash
rm src/scaffold.test.ts
```

- [x] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all series/range tests green, scaffold test gone.

- [x] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(domain): model types, series validation, range helpers, synthetic test builders"
```

---

### Task 3: Protocol constants + weighted window statistics

**Files:**
- Create: `src/domain/analysis/protocol-constants.ts`, `src/domain/analysis/stats.ts`, `src/domain/analysis/stats.test.ts`

**Interfaces:**
- Consumes: `Series`, `TimeRange`, `makeSeries`, `syntheticSeries` (Task 2).
- Produces:
  - All protocol constants (values in Global Constraints).
  - `interface WeightedStats { mean; min; max; weightS; gapS; sampleCount }`
  - `windowStats(series: Series, range: TimeRange): WeightedStats`
  - `windowStdDev(series: Series, range: TimeRange): number` — population stddev over finite in-range samples, `NaN` if none
  - `uncoveredS(series: Series, range: TimeRange): number` — range length minus covered weight (gaps + missing spans)

Weighting rule (spec §2.5): sample *i* (finite `v`, `startS ≤ t[i] < endS`) covers `span = min(rawDelta, endS − t[i])` where `rawDelta = (t[i+1] ?? endS) − t[i]`. If `rawDelta > GAP_THRESHOLD_S` the span counts as gap (`gapS`), contributing no weight. Non-finite samples contribute nothing anywhere. `mean = Σ v·span / Σ span`; `min`/`max`/`sampleCount` over finite in-range samples regardless of weight.

- [x] **Step 1: Write the failing tests**

`src/domain/analysis/stats.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { makeSeries } from '../model/series'
import { syntheticSeries } from '../testing/synthetic'
import { uncoveredS, windowStats, windowStdDev } from './stats'

describe('windowStats', () => {
  it('computes exact stats over a uniform 1Hz constant series', () => {
    const s = syntheticSeries({ durationS: 600, value: () => 10 })
    const st = windowStats(s, { startS: 0, endS: 600 })
    expect(st.mean).toBe(10)
    expect(st.min).toBe(10)
    expect(st.max).toBe(10)
    expect(st.weightS).toBe(600)
    expect(st.gapS).toBe(0)
    expect(st.sampleCount).toBe(600)
  })

  it('weights a two-level series correctly', () => {
    const s = syntheticSeries({ durationS: 200, value: (t) => (t < 100 ? 10 : 20) })
    expect(windowStats(s, { startS: 0, endS: 200 }).mean).toBe(15)
  })

  it('clips to the requested range (half-open)', () => {
    const s = syntheticSeries({ durationS: 200, value: (t) => (t < 100 ? 10 : 20) })
    expect(windowStats(s, { startS: 50, endS: 150 }).mean).toBe(15)
    expect(windowStats(s, { startS: 0, endS: 100 }).mean).toBe(10)
  })

  it('treats long sample deltas as gaps with no weight', () => {
    // 1Hz t=0..99 @10, then t=300..399 @20; delta at t=99 is 201s -> gap
    const t = [...Array(100).keys(), ...Array.from(Array(100).keys(), (i) => i + 300)]
    const v = [...Array(100).fill(10), ...Array(100).fill(20)]
    const st = windowStats(makeSeries(t, v), { startS: 0, endS: 400 })
    expect(st.weightS).toBe(199)
    expect(st.gapS).toBe(201)
    expect(st.mean).toBeCloseTo(2990 / 199, 6)
    expect(st.sampleCount).toBe(200)
    expect(st.min).toBe(10)
    expect(st.max).toBe(20)
  })

  it('skips non-finite samples entirely', () => {
    const t = [...Array(10).keys()]
    const v = Array(10).fill(5)
    v[5] = NaN
    const st = windowStats(makeSeries(t, v), { startS: 0, endS: 10 })
    expect(st.mean).toBe(5)
    expect(st.weightS).toBe(9)
    expect(st.sampleCount).toBe(9)
  })

  it('returns NaN mean and zero weight for an empty range', () => {
    const s = syntheticSeries({ durationS: 10, value: () => 1 })
    const st = windowStats(s, { startS: 100, endS: 200 })
    expect(st.mean).toBeNaN()
    expect(st.min).toBeNaN()
    expect(st.max).toBeNaN()
    expect(st.weightS).toBe(0)
    expect(st.sampleCount).toBe(0)
  })
})

describe('windowStdDev', () => {
  it('is zero for a constant series', () => {
    const s = syntheticSeries({ durationS: 100, value: () => 42 })
    expect(windowStdDev(s, { startS: 0, endS: 100 })).toBe(0)
  })

  it('computes population stddev', () => {
    expect(windowStdDev(makeSeries([0, 1], [10, 20]), { startS: 0, endS: 2 })).toBe(5)
  })

  it('is NaN with no samples', () => {
    const s = syntheticSeries({ durationS: 10, value: () => 1 })
    expect(windowStdDev(s, { startS: 50, endS: 60 })).toBeNaN()
  })
})

describe('uncoveredS', () => {
  it('is zero for full coverage', () => {
    const s = syntheticSeries({ durationS: 600, value: () => 1 })
    expect(uncoveredS(s, { startS: 0, endS: 600 })).toBe(0)
  })

  it('counts attributed gaps and missing leading spans', () => {
    const t = [...Array(100).keys(), ...Array.from(Array(100).keys(), (i) => i + 300)]
    const v = Array(200).fill(1)
    const s = makeSeries(t, v)
    // attributed gap: sample t=99 has delta 201
    expect(uncoveredS(s, { startS: 0, endS: 400 })).toBe(201)
    // leading void: no samples in [150, 300)
    expect(uncoveredS(s, { startS: 150, endS: 400 })).toBe(150)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./stats`.

- [x] **Step 3: Implement**

`src/domain/analysis/protocol-constants.ts`:

```ts
/** Spec §2 — every protocol threshold lives here. Units in the names. */
export const GAP_THRESHOLD_S = 60
export const MAX_GAP_IN_WINDOW_S = 120
export const AET_MIN_WINDOW_S = 2700
export const AET_TARGET_WINDOW_S = 3600
export const AET_DECOUPLING_AT_MIN = 3.5
export const AET_DECOUPLING_AT_MAX = 5.0
export const ANT_MIN_WINDOW_S = 1800
export const ANT_AVG_SPAN_S = 1200
export const ADS_GAP_THRESHOLD_PCT = 10
export const TEST_STALE_DAYS = 90
export const WINDOW_SUGGESTION_STEP_S = 30
```

`src/domain/analysis/stats.ts`:

```ts
import type { Series, TimeRange } from '../model/types'
import { rangeLengthS } from '../model/series'
import { GAP_THRESHOLD_S } from './protocol-constants'

export interface WeightedStats {
  mean: number
  min: number
  max: number
  /** seconds of the range covered by weighted samples */
  weightS: number
  /** seconds attributed to sample deltas exceeding GAP_THRESHOLD_S */
  gapS: number
  /** finite samples inside the range */
  sampleCount: number
}

export function windowStats(series: Series, range: TimeRange): WeightedStats {
  const { t, v } = series
  const n = t.length
  let weightedSum = 0
  let weightS = 0
  let gapS = 0
  let min = Infinity
  let max = -Infinity
  let sampleCount = 0

  for (let i = 0; i < n; i++) {
    const ti = t[i]!
    if (ti < range.startS) continue
    if (ti >= range.endS) break
    const vi = v[i]!
    if (!Number.isFinite(vi)) continue
    sampleCount++
    if (vi < min) min = vi
    if (vi > max) max = vi
    const next = i + 1 < n ? t[i + 1]! : range.endS
    const rawDelta = next - ti
    const span = Math.min(rawDelta, range.endS - ti)
    if (rawDelta > GAP_THRESHOLD_S) {
      gapS += span
    } else {
      weightedSum += vi * span
      weightS += span
    }
  }

  return {
    mean: weightS > 0 ? weightedSum / weightS : NaN,
    min: sampleCount > 0 ? min : NaN,
    max: sampleCount > 0 ? max : NaN,
    weightS,
    gapS,
    sampleCount,
  }
}

/** Population stddev over finite in-range samples, unweighted. NaN if none. */
export function windowStdDev(series: Series, range: TimeRange): number {
  const { t, v } = series
  let sum = 0
  let sumSq = 0
  let count = 0
  for (let i = 0; i < t.length; i++) {
    const ti = t[i]!
    if (ti < range.startS) continue
    if (ti >= range.endS) break
    const vi = v[i]!
    if (!Number.isFinite(vi)) continue
    sum += vi
    sumSq += vi * vi
    count++
  }
  if (count === 0) return NaN
  const mean = sum / count
  return Math.sqrt(Math.max(0, sumSq / count - mean * mean))
}

/** Seconds of the range not covered by weighted samples: gaps, dropouts, missing spans. */
export function uncoveredS(series: Series, range: TimeRange): number {
  return Math.max(0, rangeLengthS(range) - windowStats(series, range).weightS)
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(domain): protocol constants and gap-aware weighted window statistics"
```

---

### Task 4: Halves split + per-sector statistics

**Files:**
- Modify: `src/domain/analysis/stats.ts` (append `splitHalves`)
- Create: `src/domain/analysis/sector-stats.ts`, `src/domain/analysis/sector-stats.test.ts`
- Modify: `src/domain/analysis/stats.test.ts` (append `splitHalves` tests)

**Interfaces:**
- Consumes: `windowStats`, `WeightedStats` (Task 3); `Activity`, `ChannelKind`, `TimeRange` (Task 2).
- Produces:
  - `splitHalves(range: TimeRange): { first: TimeRange; second: TimeRange }` (in `stats.ts`)
  - `interface SectorChannelStats { whole; firstHalf; secondHalf }` (all `WeightedStats`)
  - `type SectorStats = Partial<Record<ChannelKind, SectorChannelStats>>`
  - `sectorStats(activity: Activity, range: TimeRange): SectorStats`

- [x] **Step 1: Write the failing tests**

Append to `src/domain/analysis/stats.test.ts`:

```ts
import { splitHalves } from './stats'

describe('splitHalves', () => {
  it('splits at the temporal midpoint', () => {
    expect(splitHalves({ startS: 100, endS: 700 })).toEqual({
      first: { startS: 100, endS: 400 },
      second: { startS: 400, endS: 700 },
    })
  })
})
```

(Vitest allows multiple import statements; place the import at the top of the file with the others.)

`src/domain/analysis/sector-stats.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { syntheticActivity, syntheticSeries } from '../testing/synthetic'
import { sectorStats } from './sector-stats'

describe('sectorStats', () => {
  it('computes whole and half stats per present channel', () => {
    const a = syntheticActivity({
      durationS: 1200,
      channels: {
        heartRate: syntheticSeries({ durationS: 1200, value: () => 150 }),
        speed: syntheticSeries({ durationS: 1200, value: (t) => (t < 600 ? 3 : 4) }),
      },
    })
    const stats = sectorStats(a, { startS: 0, endS: 1200 })
    expect(stats.speed?.whole.mean).toBe(3.5)
    expect(stats.speed?.firstHalf.mean).toBe(3)
    expect(stats.speed?.secondHalf.mean).toBe(4)
    expect(stats.heartRate?.whole.mean).toBe(150)
    expect(stats.power).toBeUndefined()
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `splitHalves` not exported; cannot resolve `./sector-stats`.

- [x] **Step 3: Implement**

Append to `src/domain/analysis/stats.ts`:

```ts
export function splitHalves(range: TimeRange): { first: TimeRange; second: TimeRange } {
  const mid = (range.startS + range.endS) / 2
  return {
    first: { startS: range.startS, endS: mid },
    second: { startS: mid, endS: range.endS },
  }
}
```

`src/domain/analysis/sector-stats.ts`:

```ts
import type { Activity, ChannelKind, TimeRange } from '../model/types'
import { splitHalves, windowStats, type WeightedStats } from './stats'

export interface SectorChannelStats {
  whole: WeightedStats
  firstHalf: WeightedStats
  secondHalf: WeightedStats
}

export type SectorStats = Partial<Record<ChannelKind, SectorChannelStats>>

export function sectorStats(activity: Activity, range: TimeRange): SectorStats {
  const { first, second } = splitHalves(range)
  const result: SectorStats = {}
  for (const [kind, series] of Object.entries(activity.channels)) {
    if (!series) continue
    result[kind as ChannelKind] = {
      whole: windowStats(series, range),
      firstHalf: windowStats(series, first),
      secondHalf: windowStats(series, second),
    }
  }
  return result
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(domain): halves split and per-sector channel statistics"
```

---

### Task 5: Decoupling (Pa:HR / Pw:HR)

**Files:**
- Create: `src/domain/analysis/decoupling.ts`, `src/domain/analysis/decoupling.test.ts`

**Interfaces:**
- Consumes: `windowStats`, `splitHalves`, `uncoveredS` (Tasks 3–4); `Series`, `TimeRange` (Task 2).
- Produces:
  - `interface HalfRatio { outputMean: number; hrMean: number; ratio: number }`
  - `interface DecouplingResult { decouplingPct: number; firstHalf: HalfRatio; secondHalf: HalfRatio; uncoveredS: number }`
  - `computeDecoupling(output: Series, hr: Series, window: TimeRange): DecouplingResult` — throws `Error(/no usable data/)` if either half of either series has zero weight

Math (spec §2.1): `ratio = mean(output)/mean(HR)` per half; `decouplingPct = (ratio₁ − ratio₂)/ratio₁ × 100`. `uncoveredS = max(uncovered(output), uncovered(hr))` over the whole window.

- [x] **Step 1: Write the failing tests**

`src/domain/analysis/decoupling.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { syntheticSeries } from '../testing/synthetic'
import { computeDecoupling } from './decoupling'

const WINDOW = { startS: 0, endS: 3600 }
const constantPace = () => syntheticSeries({ durationS: 3600, value: () => 3 })

describe('computeDecoupling', () => {
  it('is exactly 5.0 when the second-half ratio drops 5%', () => {
    // HR2 = HR1 / 0.95 makes ratio2 = 0.95 * ratio1
    const hr = syntheticSeries({ durationS: 3600, value: (t) => (t < 1800 ? 150 : 150 / 0.95) })
    const d = computeDecoupling(constantPace(), hr, WINDOW)
    expect(d.decouplingPct).toBeCloseTo(5.0, 6)
    expect(d.firstHalf.hrMean).toBeCloseTo(150, 6)
    expect(d.firstHalf.ratio).toBeCloseTo(3 / 150, 9)
  })

  it('is ~4.76 (not 5.0) when HR rises exactly 5%', () => {
    const hr = syntheticSeries({ durationS: 3600, value: (t) => (t < 1800 ? 150 : 157.5) })
    const d = computeDecoupling(constantPace(), hr, WINDOW)
    expect(d.decouplingPct).toBeCloseTo((1 - 1 / 1.05) * 100, 6) // 4.7619...
  })

  it('is negative when HR falls in the second half', () => {
    const hr = syntheticSeries({ durationS: 3600, value: (t) => (t < 1800 ? 150 : 142.5) })
    const d = computeDecoupling(constantPace(), hr, WINDOW)
    expect(d.decouplingPct).toBeCloseTo((1 - 1 / 0.95) * 100, 6) // -5.263...
  })

  it('is positive when pace fades at constant HR', () => {
    const pace = syntheticSeries({ durationS: 3600, value: (t) => (t < 1800 ? 3 : 2.85) })
    const hr = syntheticSeries({ durationS: 3600, value: () => 150 })
    const d = computeDecoupling(pace, hr, WINDOW)
    expect(d.decouplingPct).toBeCloseTo(5.0, 6)
  })

  it('reports the worst uncovered span across both series', () => {
    const pace = constantPace()
    // HR missing for [1000, 1200): 200s uncovered
    const hr = syntheticSeries({ durationS: 3600, value: (t) => 150 + (t >= 1000 && t < 1200 ? NaN : 0) })
    const d = computeDecoupling(pace, hr, WINDOW)
    expect(d.uncoveredS).toBe(200)
  })

  it('throws when a half has no usable data', () => {
    const pace = constantPace()
    const hr = syntheticSeries({ durationS: 1700, value: () => 150 }) // nothing in second half
    expect(() => computeDecoupling(pace, hr, WINDOW)).toThrow(/no usable data/)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./decoupling`.

- [x] **Step 3: Implement**

`src/domain/analysis/decoupling.ts`:

```ts
import type { Series, TimeRange } from '../model/types'
import { splitHalves, uncoveredS, windowStats } from './stats'

export interface HalfRatio {
  outputMean: number
  hrMean: number
  ratio: number
}

export interface DecouplingResult {
  decouplingPct: number
  firstHalf: HalfRatio
  secondHalf: HalfRatio
  /** worst uncovered span (s) across output and HR over the whole window */
  uncoveredS: number
}

function halfRatio(output: Series, hr: Series, half: TimeRange): HalfRatio {
  const o = windowStats(output, half)
  const h = windowStats(hr, half)
  if (o.weightS === 0 || h.weightS === 0) {
    throw new Error('decoupling window has a half with no usable data')
  }
  return { outputMean: o.mean, hrMean: h.mean, ratio: o.mean / h.mean }
}

export function computeDecoupling(
  output: Series,
  hr: Series,
  window: TimeRange,
): DecouplingResult {
  const { first, second } = splitHalves(window)
  const f = halfRatio(output, hr, first)
  const s = halfRatio(output, hr, second)
  return {
    decouplingPct: ((f.ratio - s.ratio) / f.ratio) * 100,
    firstHalf: f,
    secondHalf: s,
    uncoveredS: Math.max(uncoveredS(output, window), uncoveredS(hr, window)),
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(domain): Pa:HR / Pw:HR decoupling with analytic-value tests"
```

---

### Task 6: AeT protocol — verdicts, evaluation, result building

**Files:**
- Create: `src/domain/analysis/aet-protocol.ts`, `src/domain/analysis/aet-protocol.test.ts`

**Interfaces:**
- Consumes: `computeDecoupling`, `DecouplingResult` (Task 5); `windowStats` (Task 3); `overlapsExclusion`, `rangeLengthS` (Task 2); constants (Task 3).
- Produces:
  - `type AetWarning = 'window-too-short' | 'overlaps-exclusion' | 'gaps-in-window'`
  - `aetVerdict(decouplingPct: number): AetVerdict`
  - `interface AetEvaluation { decoupling: DecouplingResult; windowAvgHr: number; verdict: AetVerdict; warnings: AetWarning[]; valid: boolean; suggestedAetHr: number | null }`
  - `evaluateAetTest(activity: Activity, window: TimeRange, driftChannel: DriftChannel): AetEvaluation` — throws `Error(/missing channel/)` when HR or the drift channel is absent
  - `interface BuildAetArgs { id: string; activity: Activity; window: TimeRange; driftChannel: DriftChannel; evaluation: AetEvaluation; createdAt: Date; acceptAetHr?: boolean }`
  - `buildAetResult(args: BuildAetArgs): AetTestResult` — throws `Error(/invalid/)` when `!evaluation.valid`

Rules (spec §2.1): verdict `above-aet` if `d > 5.0`, `at-aet` if `3.5 ≤ d ≤ 5.0`, `below-aet` if `d < 3.5`. `valid` = not too-short and not overlapping exclusions (gaps only warn). `suggestedAetHr = round(windowAvgHr)` when `at-aet`, else null. `buildAetResult` sets `aetHr = suggestedAetHr ?? (acceptAetHr ? round(windowAvgHr) : null)`; `testDate = activity.startTime`.

- [x] **Step 1: Write the failing tests**

`src/domain/analysis/aet-protocol.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { syntheticActivity, syntheticSeries } from '../testing/synthetic'
import { AET_MIN_WINDOW_S } from './protocol-constants'
import { aetVerdict, buildAetResult, evaluateAetTest } from './aet-protocol'

function testActivity(opts?: { warmupEndS?: number }) {
  return syntheticActivity({
    durationS: 5400,
    channels: {
      speed: syntheticSeries({ durationS: 5400, value: () => 3 }),
      heartRate: syntheticSeries({
        durationS: 5400,
        // ratio drops exactly 5% across the halves of [600, 4200)
        value: (t) => (t < 2400 ? 150 : 150 / 0.95),
      }),
    },
    exclusions: { warmupEndS: opts?.warmupEndS ?? 0, cooldownStartS: 5400 },
  })
}
const WINDOW = { startS: 600, endS: 4200 }

describe('aetVerdict bands', () => {
  const cases: Array<[number, string]> = [
    [5.01, 'above-aet'],
    [5.0, 'at-aet'],
    [3.5, 'at-aet'],
    [3.49, 'below-aet'],
    [-2.0, 'below-aet'],
  ]
  it.each(cases)('%f -> %s', (d, expected) => {
    expect(aetVerdict(d)).toBe(expected)
  })
})

describe('evaluateAetTest', () => {
  it('evaluates a valid at-aet test with suggested AeT HR', () => {
    const e = evaluateAetTest(testActivity(), WINDOW, 'speed')
    expect(e.decoupling.decouplingPct).toBeCloseTo(5.0, 6)
    expect(e.verdict).toBe('at-aet')
    expect(e.valid).toBe(true)
    expect(e.warnings).toEqual([])
    // windowAvgHr: 150 for 1800s, 150/0.95 for 1800s -> 153.947...
    expect(e.windowAvgHr).toBeCloseTo((150 + 150 / 0.95) / 2, 6)
    expect(e.suggestedAetHr).toBe(154)
  })

  it('flags short windows and refuses validity', () => {
    const e = evaluateAetTest(testActivity(), { startS: 600, endS: 600 + AET_MIN_WINDOW_S - 60 }, 'speed')
    expect(e.warnings).toContain('window-too-short')
    expect(e.valid).toBe(false)
  })

  it('flags exclusion overlap and refuses validity', () => {
    const e = evaluateAetTest(testActivity({ warmupEndS: 900 }), WINDOW, 'speed')
    expect(e.warnings).toContain('overlaps-exclusion')
    expect(e.valid).toBe(false)
  })

  it('warns about gaps but stays valid', () => {
    const a = testActivity()
    // knock out 150s of HR inside the window
    const hr = syntheticSeries({
      durationS: 5400,
      value: (t) => (t >= 1000 && t < 1150 ? NaN : t < 2400 ? 150 : 150 / 0.95),
    })
    a.channels.heartRate = hr
    const e = evaluateAetTest(a, WINDOW, 'speed')
    expect(e.warnings).toContain('gaps-in-window')
    expect(e.valid).toBe(true)
  })

  it('throws on a missing drift channel', () => {
    const a = testActivity()
    delete a.channels.power
    expect(() => evaluateAetTest(a, WINDOW, 'power')).toThrow(/missing channel: power/)
  })
})

describe('buildAetResult', () => {
  const createdAt = new Date('2026-07-05T10:00:00Z')

  it('builds a result carrying the AeT HR for at-aet', () => {
    const a = testActivity()
    const e = evaluateAetTest(a, WINDOW, 'speed')
    const r = buildAetResult({ id: 'r1', activity: a, window: WINDOW, driftChannel: 'speed', evaluation: e, createdAt })
    expect(r.kind).toBe('aet')
    expect(r.aetHr).toBe(154)
    expect(r.testDate).toEqual(a.startTime)
    expect(r.verdict).toBe('at-aet')
  })

  it('leaves aetHr null for below-aet unless explicitly accepted', () => {
    const a = testActivity()
    a.channels.heartRate = syntheticSeries({ durationS: 5400, value: () => 150 }) // 0% decoupling
    const e = evaluateAetTest(a, WINDOW, 'speed')
    expect(e.verdict).toBe('below-aet')
    const rejected = buildAetResult({ id: 'r2', activity: a, window: WINDOW, driftChannel: 'speed', evaluation: e, createdAt })
    expect(rejected.aetHr).toBeNull()
    const accepted = buildAetResult({ id: 'r3', activity: a, window: WINDOW, driftChannel: 'speed', evaluation: e, createdAt, acceptAetHr: true })
    expect(accepted.aetHr).toBe(150)
  })

  it('refuses to build from an invalid evaluation', () => {
    const a = testActivity()
    const e = evaluateAetTest(a, { startS: 600, endS: 1800 }, 'speed')
    expect(() =>
      buildAetResult({ id: 'r4', activity: a, window: { startS: 600, endS: 1800 }, driftChannel: 'speed', evaluation: e, createdAt }),
    ).toThrow(/invalid/)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./aet-protocol`.

- [x] **Step 3: Implement**

`src/domain/analysis/aet-protocol.ts`:

```ts
import type { Activity, AetTestResult, AetVerdict, DriftChannel, TimeRange } from '../model/types'
import { overlapsExclusion, rangeLengthS } from '../model/series'
import { computeDecoupling, type DecouplingResult } from './decoupling'
import {
  AET_DECOUPLING_AT_MAX,
  AET_DECOUPLING_AT_MIN,
  AET_MIN_WINDOW_S,
  MAX_GAP_IN_WINDOW_S,
} from './protocol-constants'
import { windowStats } from './stats'

export type AetWarning = 'window-too-short' | 'overlaps-exclusion' | 'gaps-in-window'

export interface AetEvaluation {
  decoupling: DecouplingResult
  windowAvgHr: number
  verdict: AetVerdict
  warnings: AetWarning[]
  valid: boolean
  suggestedAetHr: number | null
}

export function aetVerdict(decouplingPct: number): AetVerdict {
  if (decouplingPct > AET_DECOUPLING_AT_MAX) return 'above-aet'
  if (decouplingPct >= AET_DECOUPLING_AT_MIN) return 'at-aet'
  return 'below-aet'
}

export function evaluateAetTest(
  activity: Activity,
  window: TimeRange,
  driftChannel: DriftChannel,
): AetEvaluation {
  const output = activity.channels[driftChannel]
  if (!output) throw new Error(`missing channel: ${driftChannel}`)
  const hr = activity.channels.heartRate
  if (!hr) throw new Error('missing channel: heartRate')

  const decoupling = computeDecoupling(output, hr, window)
  const windowAvgHr = windowStats(hr, window).mean
  const verdict = aetVerdict(decoupling.decouplingPct)

  const warnings: AetWarning[] = []
  if (rangeLengthS(window) < AET_MIN_WINDOW_S) warnings.push('window-too-short')
  if (overlapsExclusion(activity, window)) warnings.push('overlaps-exclusion')
  if (decoupling.uncoveredS > MAX_GAP_IN_WINDOW_S) warnings.push('gaps-in-window')

  return {
    decoupling,
    windowAvgHr,
    verdict,
    warnings,
    valid: !warnings.includes('window-too-short') && !warnings.includes('overlaps-exclusion'),
    suggestedAetHr: verdict === 'at-aet' ? Math.round(windowAvgHr) : null,
  }
}

export interface BuildAetArgs {
  id: string
  activity: Activity
  window: TimeRange
  driftChannel: DriftChannel
  evaluation: AetEvaluation
  createdAt: Date
  /** user explicitly accepts windowAvgHr as AeT despite a non-at-aet verdict */
  acceptAetHr?: boolean
}

export function buildAetResult(args: BuildAetArgs): AetTestResult {
  const { evaluation } = args
  if (!evaluation.valid) throw new Error('cannot save an invalid AeT test')
  return {
    kind: 'aet',
    id: args.id,
    activityId: args.activity.id,
    testDate: args.activity.startTime,
    createdAt: args.createdAt,
    window: args.window,
    driftChannel: args.driftChannel,
    decouplingPct: evaluation.decoupling.decouplingPct,
    windowAvgHr: evaluation.windowAvgHr,
    verdict: evaluation.verdict,
    aetHr:
      evaluation.suggestedAetHr ??
      (args.acceptAetHr ? Math.round(evaluation.windowAvgHr) : null),
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(domain): AeT protocol - verdict bands, evaluation, result building"
```

---

### Task 7: AnT protocol — 30-min TT, final-20-min average

**Files:**
- Create: `src/domain/analysis/ant-protocol.ts`, `src/domain/analysis/ant-protocol.test.ts`

**Interfaces:**
- Consumes: `windowStats`, `uncoveredS` (Task 3); `overlapsExclusion`, `rangeLengthS` (Task 2); constants (Task 3).
- Produces:
  - `type AntWarning = 'window-too-short' | 'overlaps-exclusion' | 'gaps-in-window'`
  - `interface AntEvaluation { antHr: number; windowAvgHr: number; windowAvgSpeed: number | null; windowAvgPower: number | null; warnings: AntWarning[]; valid: boolean }`
  - `evaluateAntTest(activity: Activity, testWindow: TimeRange): AntEvaluation` — throws on missing HR or unusable data; the parameter is named `testWindow` (never `window`) so the domain-purity grep for `window.` stays clean
  - `interface BuildAntArgs { id: string; activity: Activity; window: TimeRange; evaluation: AntEvaluation; createdAt: Date }`
  - `buildAntResult(args: BuildAntArgs): AntTestResult` — throws when `!evaluation.valid`; rounds `antHr` to integer bpm

Rules (spec §2.2): `antHr = mean(HR)` over `[max(testWindow.startS, testWindow.endS − ANT_AVG_SPAN_S), testWindow.endS)` (clamped so a too-short window never reads before its own start). Validity mirrors AeT: too-short (`< ANT_MIN_WINDOW_S`) or exclusion overlap invalidates; gaps (`uncoveredS(hr, testWindow) > MAX_GAP_IN_WINDOW_S`) only warn. The saved result also carries informational sample-weighted `windowAvgSpeed`/`windowAvgPower` over the window (spec §2.2 "average pace/power over the window"), `null` when the channel is absent or has no weighted samples.

- [x] **Step 1: Write the failing tests**

`src/domain/analysis/ant-protocol.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { syntheticActivity, syntheticSeries } from '../testing/synthetic'
import { buildAntResult, evaluateAntTest } from './ant-protocol'

// 10 min warmup-ish effort at 155, then 20 min at 168; steady 3.4 m/s
function ttActivity() {
  return syntheticActivity({
    durationS: 1800,
    channels: {
      heartRate: syntheticSeries({ durationS: 1800, value: (t) => (t < 600 ? 155 : 168) }),
      speed: syntheticSeries({ durationS: 1800, value: () => 3.4 }),
    },
  })
}
const WINDOW = { startS: 0, endS: 1800 }

describe('evaluateAntTest', () => {
  it('averages HR over the final 20 minutes', () => {
    const e = evaluateAntTest(ttActivity(), WINDOW)
    expect(e.antHr).toBe(168)
    expect(e.windowAvgHr).toBeCloseTo((600 * 155 + 1200 * 168) / 1800, 6)
    expect(e.windowAvgSpeed).toBeCloseTo(3.4, 9)
    expect(e.windowAvgPower).toBeNull()
    expect(e.valid).toBe(true)
    expect(e.warnings).toEqual([])
  })

  it('clamps the averaging span to the window start when too short', () => {
    const e = evaluateAntTest(ttActivity(), { startS: 900, endS: 1800 })
    expect(e.antHr).toBe(168) // [900, 1800) only, not [600, 1800)
    expect(e.warnings).toContain('window-too-short')
    expect(e.valid).toBe(false)
  })

  it('throws on missing heart rate', () => {
    const a = syntheticActivity({ durationS: 1800 })
    expect(() => evaluateAntTest(a, WINDOW)).toThrow(/missing channel: heartRate/)
  })
})

describe('buildAntResult', () => {
  it('builds a rounded result from a valid evaluation', () => {
    const a = ttActivity()
    const e = evaluateAntTest(a, WINDOW)
    const r = buildAntResult({ id: 'r1', activity: a, window: WINDOW, evaluation: e, createdAt: new Date('2026-07-05T10:00:00Z') })
    expect(r.kind).toBe('ant')
    expect(r.antHr).toBe(168)
    expect(r.windowAvgSpeed).toBeCloseTo(3.4, 9)
    expect(r.windowAvgPower).toBeNull()
    expect(r.testDate).toEqual(a.startTime)
  })

  it('refuses invalid evaluations', () => {
    const a = ttActivity()
    const e = evaluateAntTest(a, { startS: 900, endS: 1800 })
    expect(() =>
      buildAntResult({ id: 'r2', activity: a, window: { startS: 900, endS: 1800 }, evaluation: e, createdAt: new Date() }),
    ).toThrow(/invalid/)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./ant-protocol`.

- [x] **Step 3: Implement**

`src/domain/analysis/ant-protocol.ts`:

```ts
import type { Activity, AntTestResult, TimeRange } from '../model/types'
import { overlapsExclusion, rangeLengthS } from '../model/series'
import { ANT_AVG_SPAN_S, ANT_MIN_WINDOW_S, MAX_GAP_IN_WINDOW_S } from './protocol-constants'
import { uncoveredS, windowStats } from './stats'

export type AntWarning = 'window-too-short' | 'overlaps-exclusion' | 'gaps-in-window'

export interface AntEvaluation {
  antHr: number
  windowAvgHr: number
  /** informational, sample-weighted over the window; null when the channel is absent or empty */
  windowAvgSpeed: number | null
  windowAvgPower: number | null
  warnings: AntWarning[]
  valid: boolean
}

export function evaluateAntTest(activity: Activity, testWindow: TimeRange): AntEvaluation {
  const hr = activity.channels.heartRate
  if (!hr) throw new Error('missing channel: heartRate')

  const avgRange: TimeRange = {
    startS: Math.max(testWindow.startS, testWindow.endS - ANT_AVG_SPAN_S),
    endS: testWindow.endS,
  }
  const antStats = windowStats(hr, avgRange)
  const whole = windowStats(hr, testWindow)
  if (antStats.weightS === 0 || whole.weightS === 0) {
    throw new Error('AnT window has no usable heart-rate data')
  }

  const infoAvg = (kind: 'speed' | 'power'): number | null => {
    const series = activity.channels[kind]
    if (!series) return null
    const stats = windowStats(series, testWindow)
    return stats.weightS > 0 ? stats.mean : null
  }

  const warnings: AntWarning[] = []
  if (rangeLengthS(testWindow) < ANT_MIN_WINDOW_S) warnings.push('window-too-short')
  if (overlapsExclusion(activity, testWindow)) warnings.push('overlaps-exclusion')
  if (uncoveredS(hr, testWindow) > MAX_GAP_IN_WINDOW_S) warnings.push('gaps-in-window')

  return {
    antHr: antStats.mean,
    windowAvgHr: whole.mean,
    windowAvgSpeed: infoAvg('speed'),
    windowAvgPower: infoAvg('power'),
    warnings,
    valid: !warnings.includes('window-too-short') && !warnings.includes('overlaps-exclusion'),
  }
}

export interface BuildAntArgs {
  id: string
  activity: Activity
  window: TimeRange
  evaluation: AntEvaluation
  createdAt: Date
}

export function buildAntResult(args: BuildAntArgs): AntTestResult {
  const { evaluation } = args
  if (!evaluation.valid) throw new Error('cannot save an invalid AnT test')
  return {
    kind: 'ant',
    id: args.id,
    activityId: args.activity.id,
    testDate: args.activity.startTime,
    createdAt: args.createdAt,
    window: args.window,
    antHr: Math.round(evaluation.antHr),
    windowAvgHr: evaluation.windowAvgHr,
    windowAvgSpeed: evaluation.windowAvgSpeed,
    windowAvgPower: evaluation.windowAvgPower,
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(domain): AnT protocol - 30-min TT with final-20-min HR average"
```

---

### Task 8: ADS assessment

**Files:**
- Create: `src/domain/analysis/ads-assessment.ts`, `src/domain/analysis/ads-assessment.test.ts`

**Interfaces:**
- Consumes: `AetTestResult`, `AntTestResult`, `TestResult` (Task 2); `ADS_GAP_THRESHOLD_PCT`, `TEST_STALE_DAYS` (Task 3).
- Produces:
  - `type AdsStatus = { state: 'no-tests' } | { state: 'missing-aet'; ant: AntTestResult } | { state: 'missing-ant'; aet: AetTestResult } | { state: 'assessed'; gapPct: number; ads: boolean; aet: AetTestResult; ant: AntTestResult; aetStale: boolean; antStale: boolean }`
  - `assessAds(results: TestResult[], now: Date): AdsStatus`

Rules (spec §2.3): only AeT results with `aetHr !== null` count; most recent by `testDate` on each side; `gapPct = (antHr − aetHr)/antHr × 100`; `ads = gapPct > 10` (exactly 10 is not ADS); stale = `now − testDate > 90 days` strictly.

- [x] **Step 1: Write the failing tests**

`src/domain/analysis/ads-assessment.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { AetTestResult, AntTestResult } from '../model/types'
import { assessAds } from './ads-assessment'

const NOW = new Date('2026-07-05T00:00:00Z')

function aet(over: Partial<AetTestResult>): AetTestResult {
  return {
    kind: 'aet',
    id: 'a1',
    activityId: 'act1',
    testDate: new Date('2026-06-01T08:00:00Z'),
    createdAt: new Date('2026-06-01T10:00:00Z'),
    window: { startS: 600, endS: 4200 },
    driftChannel: 'speed',
    decouplingPct: 4.2,
    windowAvgHr: 148.2,
    verdict: 'at-aet',
    aetHr: 148,
    ...over,
  }
}

function ant(over: Partial<AntTestResult>): AntTestResult {
  return {
    kind: 'ant',
    id: 'n1',
    activityId: 'act2',
    testDate: new Date('2026-06-15T08:00:00Z'),
    createdAt: new Date('2026-06-15T10:00:00Z'),
    window: { startS: 0, endS: 1800 },
    antHr: 165,
    windowAvgHr: 163.7,
    windowAvgSpeed: 3.4,
    windowAvgPower: null,
    ...over,
  }
}

describe('assessAds', () => {
  it('handles no tests', () => {
    expect(assessAds([], NOW)).toEqual({ state: 'no-tests' })
  })

  it('reports the missing side', () => {
    expect(assessAds([aet({})], NOW).state).toBe('missing-ant')
    expect(assessAds([ant({})], NOW).state).toBe('missing-aet')
  })

  it('ignores AeT results without an accepted AeT HR', () => {
    expect(assessAds([aet({ aetHr: null }), ant({})], NOW).state).toBe('missing-aet')
  })

  it('assesses ADS when the gap exceeds 10%', () => {
    const s = assessAds([aet({ aetHr: 148 }), ant({ antHr: 165 })], NOW)
    expect(s.state).toBe('assessed')
    if (s.state !== 'assessed') return
    expect(s.gapPct).toBeCloseTo(((165 - 148) / 165) * 100, 6) // 10.303...
    expect(s.ads).toBe(true)
  })

  it('is balanced at or below 10%', () => {
    const under = assessAds([aet({ aetHr: 150 }), ant({ antHr: 165 })], NOW)
    if (under.state !== 'assessed') throw new Error('expected assessed')
    expect(under.ads).toBe(false) // 9.09%
    const exact = assessAds([aet({ aetHr: 144 }), ant({ antHr: 160 })], NOW)
    if (exact.state !== 'assessed') throw new Error('expected assessed')
    expect(exact.gapPct).toBeCloseTo(10, 9)
    expect(exact.ads).toBe(false) // exactly 10 is not ADS
  })

  it('picks the most recent result per side', () => {
    const s = assessAds(
      [
        aet({ id: 'old', testDate: new Date('2026-05-01T08:00:00Z'), aetHr: 140 }),
        aet({ id: 'new', testDate: new Date('2026-06-01T08:00:00Z'), aetHr: 148 }),
        ant({}),
      ],
      NOW,
    )
    if (s.state !== 'assessed') throw new Error('expected assessed')
    expect(s.aet.id).toBe('new')
  })

  it('marks staleness strictly beyond 90 days', () => {
    const fresh = assessAds(
      [aet({ testDate: new Date('2026-04-06T00:00:01Z') }), ant({})],
      NOW,
    )
    if (fresh.state !== 'assessed') throw new Error('expected assessed')
    expect(fresh.aetStale).toBe(false)
    const stale = assessAds(
      [aet({ testDate: new Date('2026-04-05T23:59:59Z') }), ant({})],
      NOW,
    )
    if (stale.state !== 'assessed') throw new Error('expected assessed')
    expect(stale.aetStale).toBe(true)
    expect(stale.antStale).toBe(false)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./ads-assessment`.

- [x] **Step 3: Implement**

`src/domain/analysis/ads-assessment.ts`:

```ts
import type { AetTestResult, AntTestResult, TestResult } from '../model/types'
import { ADS_GAP_THRESHOLD_PCT, TEST_STALE_DAYS } from './protocol-constants'

export type AdsStatus =
  | { state: 'no-tests' }
  | { state: 'missing-aet'; ant: AntTestResult }
  | { state: 'missing-ant'; aet: AetTestResult }
  | {
      state: 'assessed'
      gapPct: number
      ads: boolean
      aet: AetTestResult
      ant: AntTestResult
      aetStale: boolean
      antStale: boolean
    }

const STALE_MS = TEST_STALE_DAYS * 24 * 60 * 60 * 1000

function latest<T extends TestResult>(results: T[]): T | null {
  let best: T | null = null
  for (const r of results) {
    if (!best || r.testDate.getTime() > best.testDate.getTime()) best = r
  }
  return best
}

export function assessAds(results: TestResult[], now: Date): AdsStatus {
  const aet = latest(
    results.filter((r): r is AetTestResult => r.kind === 'aet' && r.aetHr !== null),
  )
  const ant = latest(results.filter((r): r is AntTestResult => r.kind === 'ant'))

  if (!aet && !ant) return { state: 'no-tests' }
  if (!aet) return { state: 'missing-aet', ant: ant! }
  if (!ant) return { state: 'missing-ant', aet }

  const gapPct = ((ant.antHr - aet.aetHr!) / ant.antHr) * 100
  const isStale = (r: TestResult) => now.getTime() - r.testDate.getTime() > STALE_MS
  return {
    state: 'assessed',
    gapPct,
    ads: gapPct > ADS_GAP_THRESHOLD_PCT,
    aet,
    ant,
    aetStale: isStale(aet),
    antStale: isStale(ant),
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(domain): ADS assessment derived from latest AeT/AnT results"
```

---

### Task 9: Test-window auto-suggestion

**Files:**
- Create: `src/domain/analysis/window-suggestion.ts`, `src/domain/analysis/window-suggestion.test.ts`

**Interfaces:**
- Consumes: `windowStdDev`, `uncoveredS` (Task 3); `nonExcludedRange`, `rangeLengthS` (Task 2); `MAX_GAP_IN_WINDOW_S`, `WINDOW_SUGGESTION_STEP_S` (Task 3).
- Produces:
  - `interface SuggestOpts { targetLengthS: number; minLengthS: number }`
  - `suggestWindow(activity: Activity, opts: SuggestOpts): TimeRange | null`

Rules (spec §2.6): no HR channel → `null`. Non-excluded span shorter than `minLengthS` → `null`; shorter than `targetLengthS` → the whole span. Otherwise slide a `targetLengthS` window from the span start in `WINDOW_SUGGESTION_STEP_S` steps; skip candidates with `uncoveredS(hr) > MAX_GAP_IN_WINDOW_S`; pick minimum HR stddev, ties to earliest; if every candidate is skipped, fall back to minimum stddev over all candidates.

- [x] **Step 1: Write the failing tests**

`src/domain/analysis/window-suggestion.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { makeSeries } from '../model/series'
import { syntheticActivity, syntheticSeries } from '../testing/synthetic'
import { suggestWindow } from './window-suggestion'

const OPTS = { targetLengthS: 3600, minLengthS: 2700 }

describe('suggestWindow', () => {
  it('returns null without a heart-rate channel', () => {
    expect(suggestWindow(syntheticActivity({ durationS: 7200 }), OPTS)).toBeNull()
  })

  it('returns null when the non-excluded span is below the minimum', () => {
    const a = syntheticActivity({
      durationS: 2000,
      channels: { heartRate: syntheticSeries({ durationS: 2000, value: () => 150 }) },
    })
    expect(suggestWindow(a, OPTS)).toBeNull()
  })

  it('returns the whole span when shorter than the target but above the minimum', () => {
    const a = syntheticActivity({
      durationS: 3000,
      channels: { heartRate: syntheticSeries({ durationS: 3000, value: () => 150 }) },
    })
    expect(suggestWindow(a, OPTS)).toEqual({ startS: 0, endS: 3000 })
  })

  it('picks the steadiest window, earliest on ties', () => {
    const a = syntheticActivity({
      durationS: 5400,
      channels: {
        heartRate: syntheticSeries({
          durationS: 5400,
          value: (t) => (t < 1500 ? 150 + 10 * Math.sin(t / 30) : 150),
        }),
      },
      exclusions: { warmupEndS: 600, cooldownStartS: 5400 },
    })
    expect(suggestWindow(a, OPTS)).toEqual({ startS: 1500, endS: 5100 })
  })

  it('skips windows with too much uncovered time', () => {
    // constant HR but samples missing for [1000, 1200)
    const t: number[] = []
    for (let i = 0; i < 7200; i++) if (i < 1000 || i >= 1200) t.push(i)
    const hr = makeSeries(t, Array(t.length).fill(150))
    const a = syntheticActivity({ durationS: 7200, channels: { heartRate: hr } })
    // earliest start with uncovered <= 120s is 1080
    expect(suggestWindow(a, OPTS)).toEqual({ startS: 1080, endS: 4680 })
  })

  it('falls back to best-anyway when every candidate has gaps', () => {
    const t: number[] = []
    for (let i = 0; i < 4000; i++) if (i < 1800 || i >= 2400) t.push(i)
    const hr = makeSeries(t, Array(t.length).fill(150))
    const a = syntheticActivity({ durationS: 4000, channels: { heartRate: hr } })
    expect(suggestWindow(a, OPTS)).toEqual({ startS: 0, endS: 3600 })
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./window-suggestion`.

- [x] **Step 3: Implement**

`src/domain/analysis/window-suggestion.ts`:

```ts
import type { Activity, TimeRange } from '../model/types'
import { nonExcludedRange, rangeLengthS } from '../model/series'
import { MAX_GAP_IN_WINDOW_S, WINDOW_SUGGESTION_STEP_S } from './protocol-constants'
import { uncoveredS, windowStdDev } from './stats'

export interface SuggestOpts {
  targetLengthS: number
  minLengthS: number
}

export function suggestWindow(activity: Activity, opts: SuggestOpts): TimeRange | null {
  const hr = activity.channels.heartRate
  if (!hr) return null

  const span = nonExcludedRange(activity)
  const spanLen = rangeLengthS(span)
  if (spanLen < opts.minLengthS) return null
  if (spanLen < opts.targetLengthS) return span

  let best: TimeRange | null = null
  let bestStdDev = Infinity
  let bestAny: TimeRange | null = null
  let bestAnyStdDev = Infinity

  for (let s = span.startS; s <= span.endS - opts.targetLengthS; s += WINDOW_SUGGESTION_STEP_S) {
    const cand: TimeRange = { startS: s, endS: s + opts.targetLengthS }
    const sd = windowStdDev(hr, cand)
    if (Number.isNaN(sd)) continue
    if (sd < bestAnyStdDev) {
      bestAnyStdDev = sd
      bestAny = cand
    }
    if (uncoveredS(hr, cand) > MAX_GAP_IN_WINDOW_S) continue
    if (sd < bestStdDev) {
      bestStdDev = sd
      best = cand
    }
  }

  return best ?? bestAny
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [x] **Step 5: Run the full gate and commit**

Run: `npm test && npm run lint && npm run build`
Expected: all green.

```bash
git add -A
git commit -m "feat(domain): steadiest-window auto-suggestion with gap skipping"
```

---

## Definition of done (milestone 1)

- `npm test` green: series/stats/sector/decoupling/AeT/AnT/ADS/suggestion suites all passing.
- `npm run lint` and `npm run build` exit 0.
- `npm run dev` serves the placeholder app.
- `src/domain/**` has zero imports from React/DOM/Dexie/Garmin SDK (verify: `grep -rE "from 'react|from 'dexie|@garmin|document\.|window\." src/domain/` returns nothing).
