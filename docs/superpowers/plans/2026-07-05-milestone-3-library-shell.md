# Milestone 3: App Shell, Import Pipeline & Library Screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app becomes usable software: drop FIT/zip files onto a dark-scientific Library screen, see imported runs in a data table with real stats, and read the ADS status card — with dedupe, per-file error toasts, and a session-only fallback when IndexedDB is unavailable.

**Architecture:** Composition root (`app/container.ts`) wires the milestone-2 adapters behind one React context. A pure `importFiles` service orchestrates parser → dedupe → repository. A new `InMemoryLibraryRepository` adapter doubles as the IndexedDB-unavailable fallback and as the fast test double, verified by a shared repository contract test. UI is Tailwind v4 + vendored shadcn-style components (button/card/badge) themed dark-only.

**Tech Stack:** tailwindcss v4 (+@tailwindcss/vite), IBM Plex Mono + Inter Variable (@fontsource, self-hosted), class-variance-authority + clsx + tailwind-merge, sonner (toasts), react-router-dom, jsdom + Testing Library (component tests).

## Design direction (locked)

- **Palette:** bg `#0b0e14` (instrument blue-black), surface `#131720`, surface-2 `#1a2029`, hairlines `#232b36`, ink `#e6ebf0`, muted `#8a97a5`. Channel colors reserved for data everywhere: HR `#ff6b6b`, pace `#4cc9f0`, power `#a78bfa`, cadence `#ffc53d`, altitude `#6bcb77`. Semantic: ok `#3dd68c`, caution `#f5a524`, danger `#f0525f`. Focus ring `#5b9dff`. Primary buttons are near-white fill on dark (color budget is spent on data, not chrome).
- **Type:** IBM Plex Mono carries the personality — the brand mark, all numerals, table data, labels/eyebrows (uppercase, tracked). Inter Variable for body/UI prose. Dark-only (`color-scheme: dark`).
- **Signature element:** the ADS readout card — a lab-instrument threshold meter (0–20% scale, redline tick at 10%, needle at the current gap) with test provenance lines beneath like a report footer. Present in every state, including empty.
- **Copy:** sentence case, active, specific. Empty ≠ sad: "No runs yet. Drop a FIT file to begin."

## Global Constraints

- Everything from milestones 1–2 Global Constraints applies (strict TS, domain purity, TDD, commit style, manifest rule).
- Component tests run in jsdom via a first-line docblock `// @vitest-environment jsdom`; unit tests stay in node. No `globals: true` — explicit imports, explicit `afterEach(cleanup)`.
- Presentational components take props; data fetching lives in screens/hooks. Tests exercise components with props and screens with a real `InMemoryLibraryRepository` + real parser + real fixtures.
- Path alias `@/` → `src/` (tsconfig `paths` + vite `resolve.alias`).
- SI units internally; all formatting at the UI edge via `src/app/format.ts`.

---

### Task 1: UI toolchain, theme, app shell

**Files:**
- Modify: `package.json` (installs), `vite.config.ts` (tailwind plugin, alias, tsx tests), `tsconfig.json` (paths), `src/main.tsx` (css+fonts import), `src/App.tsx` (shell)
- Create: `src/index.css`, `src/app/brand.ts`, `src/lib/utils.ts`, `src/App.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: theme tokens (utility classes `bg-bg`, `text-ink`, `text-ink-muted`, `border-line`, `bg-surface`, `bg-surface-2`, `text-ch-hr` …, `font-mono`, `font-sans`), `BRAND` constant, `cn(...inputs)` class combiner, working jsdom component-test pipeline.

- [ ] **Step 1: Install dependencies**

```bash
npm install tailwindcss @tailwindcss/vite @fontsource-variable/inter @fontsource/ibm-plex-mono class-variance-authority clsx tailwind-merge sonner react-router-dom
npm install -D jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Wire toolchain config**

`vite.config.ts` (full replacement):

```ts
/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
```

`tsconfig.json`: add to `compilerOptions`:

```json
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 3: Write the failing shell test**

`src/App.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from './App'

afterEach(cleanup)

describe('AppShell', () => {
  it('renders the brand header around its content', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <p>content here</p>
        </AppShell>
      </MemoryRouter>,
    )
    expect(screen.getByRole('banner')).toHaveTextContent(/runalyze/i)
    expect(screen.getByText('content here')).toBeInTheDocument()
  })
})
```

(Note: `toHaveTextContent`/`toBeInTheDocument` need `import '@testing-library/jest-dom/vitest'` — add it as the second import line.)

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `AppShell` is not exported.

- [ ] **Step 5: Implement theme and shell**

`src/index.css`:

```css
@import 'tailwindcss';

@theme {
  --font-sans: 'Inter Variable', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;

  --color-bg: #0b0e14;
  --color-surface: #131720;
  --color-surface-2: #1a2029;
  --color-line: #232b36;
  --color-ink: #e6ebf0;
  --color-ink-muted: #8a97a5;

  --color-ch-hr: #ff6b6b;
  --color-ch-pace: #4cc9f0;
  --color-ch-power: #a78bfa;
  --color-ch-cadence: #ffc53d;
  --color-ch-altitude: #6bcb77;

  --color-ok: #3dd68c;
  --color-caution: #f5a524;
  --color-danger: #f0525f;
  --color-focus: #5b9dff;
}

@layer base {
  html {
    color-scheme: dark;
  }
  body {
    @apply bg-bg font-sans text-ink antialiased;
  }
  :focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
}
```

`src/app/brand.ts`:

```ts
export const BRAND = 'Runalyze'
export const TAGLINE = 'aerobic base lab'
```

`src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

`src/App.tsx` (full replacement — router arrives in Task 6, so `App` renders a placeholder inside the shell for now):

```tsx
import type { ReactNode } from 'react'
import { BRAND, TAGLINE } from './app/brand'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header
        role="banner"
        className="flex items-baseline gap-3 border-b border-line px-6 py-3"
      >
        <span className="font-mono text-sm font-semibold uppercase tracking-[0.25em]">
          {BRAND}
        </span>
        <span className="font-mono text-xs uppercase tracking-widest text-ink-muted">
          {TAGLINE}
        </span>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}

export function App() {
  return (
    <AppShell>
      <p className="text-ink-muted">No runs yet. Drop a FIT file to begin.</p>
    </AppShell>
  )
}
```

`src/main.tsx` (full replacement):

```tsx
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 6: Run tests, lint, build; commit**

Run: `npm test && npm run lint && npm run build`
Expected: all green.

```bash
git add -A
git commit -m "feat(app): Tailwind v4 dark-scientific theme, brand shell, jsdom test pipeline"
```

---

### Task 2: Format utilities (UI edge)

**Files:**
- Create: `src/app/format.ts`, `src/app/format.test.ts`

**Interfaces:**
- Produces:
  - `formatDuration(s: number): string` — `'12:34'` under an hour, `'1:01:01'` above; rounds seconds
  - `formatPace(mPerS: number): string` — min/km like `'6:39 /km'`; `'–'` for non-finite or ≤ 0
  - `formatDistanceKm(m: number | null): string` — `'9.04 km'`; `'–'` for null
  - `formatBpm(v: number | null): string` — `'159 bpm'` rounded; `'–'` for null
  - `formatDate(d: Date): string` — ISO date part `'2026-07-05'`

- [ ] **Step 1: Write the failing tests**

`src/app/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatBpm, formatDate, formatDistanceKm, formatDuration, formatPace } from './format'

describe('format', () => {
  it('formats durations', () => {
    expect(formatDuration(45)).toBe('0:45')
    expect(formatDuration(754)).toBe('12:34')
    expect(formatDuration(3600.873)).toBe('1:00:01')
    expect(formatDuration(10644.774)).toBe('2:57:25')
  })

  it('formats pace from speed', () => {
    expect(formatPace(2.5059)).toBe('6:39 /km') // 399.06 s/km
    expect(formatPace(3)).toBe('5:33 /km') // 333.33 s/km
    expect(formatPace(0)).toBe('–')
    expect(formatPace(NaN)).toBe('–')
  })

  it('formats distance and bpm', () => {
    expect(formatDistanceKm(9035.12)).toBe('9.04 km')
    expect(formatDistanceKm(30016.3)).toBe('30.02 km')
    expect(formatDistanceKm(null)).toBe('–')
    expect(formatBpm(159.0103)).toBe('159 bpm')
    expect(formatBpm(null)).toBe('–')
  })

  it('formats dates as ISO date part', () => {
    expect(formatDate(new Date('2026-07-05T06:45:13.000Z'))).toBe('2026-07-05')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` — Expected: FAIL, cannot resolve `./format`.

- [ ] **Step 3: Implement**

`src/app/format.ts`:

```ts
export function formatDuration(s: number): string {
  const total = Math.round(s)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`
}

export function formatPace(mPerS: number): string {
  if (!Number.isFinite(mPerS) || mPerS <= 0) return '–'
  const sPerKm = Math.round(1000 / mPerS)
  const m = Math.floor(sPerKm / 60)
  const s = sPerKm % 60
  return `${m}:${String(s).padStart(2, '0')} /km`
}

export function formatDistanceKm(m: number | null): string {
  if (m === null || !Number.isFinite(m)) return '–'
  return `${(m / 1000).toFixed(2)} km`
}

export function formatBpm(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '–'
  return `${Math.round(v)} bpm`
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
```

- [ ] **Step 4: Verify pass; commit**

Run: `npm test` — Expected: PASS.

```bash
git add -A && git commit -m "feat(app): SI-to-display format utilities"
```

---

### Task 3: Activity summary (domain)

**Files:**
- Create: `src/domain/analysis/activity-summary.ts`, `src/domain/analysis/activity-summary.test.ts`

**Interfaces:**
- Consumes: `windowStats`, `nonExcludedRange` (milestone 1).
- Produces:
  - `interface ActivitySummary { durationS: number; distanceM: number | null; avgHr: number | null; avgSpeed: number | null; avgPower: number | null }`
  - `activitySummary(a: Activity): ActivitySummary` — averages are sample-weighted over the non-excluded range (`null` when the channel is absent or has no weight); `distanceM` = last minus first sample of the cumulative distance channel.

- [ ] **Step 1: Write the failing tests**

`src/domain/analysis/activity-summary.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { makeSeries } from '../model/series'
import { syntheticActivity, syntheticSeries } from '../testing/synthetic'
import { activitySummary } from './activity-summary'

describe('activitySummary', () => {
  it('summarizes present channels and nulls absent ones', () => {
    const a = syntheticActivity({
      durationS: 600,
      channels: {
        heartRate: syntheticSeries({ durationS: 600, value: () => 150 }),
        speed: syntheticSeries({ durationS: 600, value: () => 3 }),
        distance: syntheticSeries({ durationS: 600, value: (t) => t * 3 }),
      },
    })
    const s = activitySummary(a)
    expect(s.durationS).toBe(600)
    expect(s.avgHr).toBe(150)
    expect(s.avgSpeed).toBe(3)
    expect(s.avgPower).toBeNull()
    expect(s.distanceM).toBe(599 * 3) // last sample at t=599
  })

  it('respects exclusions for averages', () => {
    const a = syntheticActivity({
      durationS: 600,
      channels: {
        heartRate: syntheticSeries({ durationS: 600, value: (t) => (t < 300 ? 100 : 150) }),
      },
      exclusions: { warmupEndS: 300, cooldownStartS: 600 },
    })
    expect(activitySummary(a).avgHr).toBe(150)
  })

  it('handles an activity with no channels', () => {
    const s = activitySummary(syntheticActivity({ durationS: 60 }))
    expect(s.avgHr).toBeNull()
    expect(s.distanceM).toBeNull()
  })

  it('nulls averages when the channel has no samples in range', () => {
    const a = syntheticActivity({
      durationS: 600,
      channels: { heartRate: makeSeries([0, 1], [150, 151]) },
      exclusions: { warmupEndS: 300, cooldownStartS: 600 },
    })
    expect(activitySummary(a).avgHr).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify fail** — `npm test`, FAIL on missing module.

- [ ] **Step 3: Implement**

`src/domain/analysis/activity-summary.ts`:

```ts
import type { Activity, ChannelKind } from '../model/types'
import { nonExcludedRange } from '../model/series'
import { windowStats } from './stats'

export interface ActivitySummary {
  durationS: number
  distanceM: number | null
  avgHr: number | null
  avgSpeed: number | null
  avgPower: number | null
}

export function activitySummary(a: Activity): ActivitySummary {
  const range = nonExcludedRange(a)
  const avg = (kind: ChannelKind): number | null => {
    const series = a.channels[kind]
    if (!series) return null
    const stats = windowStats(series, range)
    return stats.weightS > 0 ? stats.mean : null
  }
  const distance = a.channels.distance
  const distanceM =
    distance && distance.v.length > 0 ? distance.v[distance.v.length - 1]! - distance.v[0]! : null
  return {
    durationS: a.durationS,
    distanceM,
    avgHr: avg('heartRate'),
    avgSpeed: avg('speed'),
    avgPower: avg('power'),
  }
}
```

- [ ] **Step 4: Verify pass; commit**

```bash
git add -A && git commit -m "feat(domain): activity summary for library display"
```

---

### Task 4: In-memory repository (contract-tested) + import service

**Files:**
- Create: `src/adapters/storage/library-repository-contract.ts`, `src/adapters/storage/in-memory-library-repository.ts`, `src/adapters/storage/in-memory-library-repository.test.ts`, `src/app/import-service.ts`, `src/app/import-service.test.ts`
- Modify: `src/adapters/storage/dexie-library-repository.test.ts` (delegate to the contract)

**Interfaces:**
- Consumes: `LibraryRepository` port; `GarminFitFileParser`; fixtures.
- Produces:
  - `libraryRepositoryContract(makeRepo: () => LibraryRepository): void` — the behavioral spec both adapters must pass
  - `class InMemoryLibraryRepository implements LibraryRepository` — also the IndexedDB-unavailable fallback; `structuredClone` on save/load for storage parity
  - `type ImportResult = { status: 'imported' | 'duplicate'; filename: string; activityId: string } | { status: 'error'; filename: string; reason: string }`
  - `importFiles(files: Array<{ name: string; bytes: Uint8Array }>, parser: ActivityFileParser, repo: LibraryRepository): Promise<ImportResult[]>`

- [ ] **Step 1: Extract the contract and write the failing tests**

`src/adapters/storage/library-repository-contract.ts` — move the eight test cases from `dexie-library-repository.test.ts` verbatim into an exported function, replacing `freshRepo()` with the injected factory (body identical to the current file's tests, so it is not repeated here in full — it is a mechanical move):

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { makeSeries } from '../../domain/model/series'
import type { AetTestResult, Note, Sector } from '../../domain/model/types'
import { syntheticActivity } from '../../domain/testing/synthetic'
import type { LibraryRepository } from '../../domain/ports/library-repository'

export function libraryRepositoryContract(makeRepo: () => LibraryRepository): void {
  // ... the eight `it(...)` cases currently in dexie-library-repository.test.ts,
  // each starting `const repo = makeRepo()` instead of `freshRepo()`,
  // wrapped in describe('LibraryRepository contract', ...)
}
```

`src/adapters/storage/dexie-library-repository.test.ts` becomes:

```ts
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { DexieLibraryRepository } from './dexie-library-repository'
import { libraryRepositoryContract } from './library-repository-contract'

let counter = 0
libraryRepositoryContract(
  () =>
    new DexieLibraryRepository({
      name: `test-db-${++counter}`,
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    }),
)
```

`src/adapters/storage/in-memory-library-repository.test.ts`:

```ts
import { InMemoryLibraryRepository } from './in-memory-library-repository'
import { libraryRepositoryContract } from './library-repository-contract'

libraryRepositoryContract(() => new InMemoryLibraryRepository())
```

`src/app/import-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { GarminFitFileParser } from '../adapters/fit/fit-file-parser'
import { InMemoryLibraryRepository } from '../adapters/storage/in-memory-library-repository'
import { fixtureBytes } from '../adapters/testing/fixtures'
import { importFiles } from './import-service'

const parser = new GarminFitFileParser()

describe('importFiles', () => {
  it('imports new files, flags duplicates, isolates errors', async () => {
    const repo = new InMemoryLibraryRepository()
    const first = await importFiles(
      [{ name: 'Activity.fit', bytes: fixtureBytes('Activity.fit') }],
      parser,
      repo,
    )
    expect(first).toHaveLength(1)
    expect(first[0]!.status).toBe('imported')

    const second = await importFiles(
      [
        { name: 'again.fit', bytes: fixtureBytes('Activity.fit') },
        { name: 'not-a-fit.txt', bytes: fixtureBytes('not-a-fit.txt') },
      ],
      parser,
      repo,
    )
    expect(second.map((r) => r.status)).toEqual(['duplicate', 'error'])
    expect(await repo.listActivities()).toHaveLength(1)
  })

  it('expands zips into per-entry results', async () => {
    const repo = new InMemoryLibraryRepository()
    const results = await importFiles(
      [{ name: 'activities.zip', bytes: fixtureBytes('activities.zip') }],
      parser,
      repo,
    )
    expect(results).toHaveLength(2)
    expect(results.every((r) => r.status === 'imported')).toBe(true)
    expect(await repo.listActivities()).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run to verify fail** — `npm test`: FAIL on missing modules (contract file import in dexie test, in-memory class, import service).

- [ ] **Step 3: Implement**

`src/adapters/storage/in-memory-library-repository.ts`:

```ts
import type { Activity, Exclusions, Note, Sector, TestResult } from '../../domain/model/types'
import type { LibraryRepository } from '../../domain/ports/library-repository'

/** Fallback for when IndexedDB is unavailable; also the fast test double. */
export class InMemoryLibraryRepository implements LibraryRepository {
  private readonly activities = new Map<string, Activity>()
  private readonly rawFiles = new Map<string, Uint8Array>()
  private readonly sectors = new Map<string, Sector>()
  private readonly testResults = new Map<string, TestResult>()
  private readonly notes = new Map<string, Note>()

  async saveActivity(activity: Activity, rawBytes: Uint8Array): Promise<void> {
    this.activities.set(activity.id, structuredClone(activity))
    this.rawFiles.set(activity.id, structuredClone(rawBytes))
  }

  async getActivity(id: string): Promise<Activity | null> {
    const a = this.activities.get(id)
    return a ? structuredClone(a) : null
  }

  async hasActivity(id: string): Promise<boolean> {
    return this.activities.has(id)
  }

  async listActivities(): Promise<Activity[]> {
    return [...this.activities.values()]
      .map((a) => structuredClone(a))
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
  }

  async deleteActivity(id: string): Promise<void> {
    this.activities.delete(id)
    this.rawFiles.delete(id)
    for (const [sid, s] of this.sectors) if (s.activityId === id) this.sectors.delete(sid)
    for (const [tid, t] of this.testResults) if (t.activityId === id) this.testResults.delete(tid)
    this.notes.delete(id)
  }

  async getRawFile(id: string): Promise<Uint8Array | null> {
    const bytes = this.rawFiles.get(id)
    return bytes ? structuredClone(bytes) : null
  }

  async updateExclusions(activityId: string, exclusions: Exclusions): Promise<void> {
    const a = this.activities.get(activityId)
    if (!a) throw new Error(`activity not found: ${activityId}`)
    a.exclusions = structuredClone(exclusions)
  }

  async saveSector(sector: Sector): Promise<void> {
    this.sectors.set(sector.id, structuredClone(sector))
  }

  async listSectors(activityId: string): Promise<Sector[]> {
    return [...this.sectors.values()]
      .filter((s) => s.activityId === activityId)
      .map((s) => structuredClone(s))
  }

  async deleteSector(id: string): Promise<void> {
    this.sectors.delete(id)
  }

  async saveTestResult(result: TestResult): Promise<void> {
    this.testResults.set(result.id, structuredClone(result))
  }

  async listTestResults(): Promise<TestResult[]> {
    return [...this.testResults.values()].map((t) => structuredClone(t))
  }

  async deleteTestResult(id: string): Promise<void> {
    this.testResults.delete(id)
  }

  async saveNote(note: Note): Promise<void> {
    this.notes.set(note.activityId, structuredClone(note))
  }

  async getNote(activityId: string): Promise<Note | null> {
    const n = this.notes.get(activityId)
    return n ? structuredClone(n) : null
  }
}
```

`src/app/import-service.ts`:

```ts
import type { ActivityFileParser } from '../domain/ports/activity-file-parser'
import type { LibraryRepository } from '../domain/ports/library-repository'

export type ImportResult =
  | { status: 'imported' | 'duplicate'; filename: string; activityId: string }
  | { status: 'error'; filename: string; reason: string }

export async function importFiles(
  files: Array<{ name: string; bytes: Uint8Array }>,
  parser: ActivityFileParser,
  repo: LibraryRepository,
): Promise<ImportResult[]> {
  const results: ImportResult[] = []
  for (const file of files) {
    const outcomes = await parser.parse(file.bytes, file.name)
    for (const outcome of outcomes) {
      if (!outcome.ok) {
        results.push({ status: 'error', filename: outcome.filename, reason: outcome.reason })
        continue
      }
      if (await repo.hasActivity(outcome.activity.id)) {
        results.push({
          status: 'duplicate',
          filename: outcome.filename,
          activityId: outcome.activity.id,
        })
        continue
      }
      await repo.saveActivity(outcome.activity, outcome.rawBytes)
      results.push({
        status: 'imported',
        filename: outcome.filename,
        activityId: outcome.activity.id,
      })
    }
  }
  return results
}
```

- [ ] **Step 4: Verify pass; commit**

Run: `npm test` — Expected: PASS (contract runs twice: Dexie + in-memory).

```bash
git add -A && git commit -m "feat(app): import service with dedupe; in-memory repository verified by shared contract"
```

---

### Task 5: Composition root, container context, data hooks

**Files:**
- Create: `src/app/container.ts`, `src/app/container.test.ts`, `src/app/container-context.tsx`, `src/app/hooks.ts`

**Interfaces:**
- Consumes: both repository adapters, `GarminFitFileParser`.
- Produces:
  - `interface Container { parser: ActivityFileParser; repo: LibraryRepository; persistent: boolean }`
  - `createContainer(): Promise<Container>` — probes Dexie with a real call; on failure falls back to `InMemoryLibraryRepository` with `persistent: false`
  - `ContainerProvider` / `useContainer()` (throws outside provider)
  - `useActivities(): { activities: Activity[]; loading: boolean; refresh: () => void }`
  - `useTestResults(): { results: TestResult[]; refresh: () => void }`

- [ ] **Step 1: Write the failing test**

`src/app/container.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { InMemoryLibraryRepository } from '../adapters/storage/in-memory-library-repository'
import { createContainer } from './container'

describe('createContainer', () => {
  it('falls back to in-memory storage when IndexedDB is unavailable', async () => {
    // node test env has no indexedDB
    const c = await createContainer()
    expect(c.persistent).toBe(false)
    expect(c.repo).toBeInstanceOf(InMemoryLibraryRepository)
    await c.repo.saveActivity(
      {
        id: 'x',
        startTime: new Date(),
        durationS: 1,
        sport: 'running',
        device: null,
        channels: {},
        exclusions: { warmupEndS: 0, cooldownStartS: 1 },
      },
      new Uint8Array(),
    )
    expect(await c.repo.hasActivity('x')).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify fail** — missing module.

- [ ] **Step 3: Implement**

`src/app/container.ts`:

```ts
import { GarminFitFileParser } from '../adapters/fit/fit-file-parser'
import { DexieLibraryRepository } from '../adapters/storage/dexie-library-repository'
import { InMemoryLibraryRepository } from '../adapters/storage/in-memory-library-repository'
import type { ActivityFileParser } from '../domain/ports/activity-file-parser'
import type { LibraryRepository } from '../domain/ports/library-repository'

export interface Container {
  parser: ActivityFileParser
  repo: LibraryRepository
  persistent: boolean
}

export async function createContainer(): Promise<Container> {
  const parser = new GarminFitFileParser()
  try {
    const repo = new DexieLibraryRepository()
    await repo.listActivities() // probe: throws where IndexedDB is unavailable
    return { parser, repo, persistent: true }
  } catch {
    return { parser, repo: new InMemoryLibraryRepository(), persistent: false }
  }
}
```

`src/app/container-context.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from 'react'
import type { Container } from './container'

const ContainerContext = createContext<Container | null>(null)

export function ContainerProvider({
  container,
  children,
}: {
  container: Container
  children: ReactNode
}) {
  return <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>
}

export function useContainer(): Container {
  const c = useContext(ContainerContext)
  if (!c) throw new Error('useContainer must be used inside ContainerProvider')
  return c
}
```

`src/app/hooks.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import type { Activity, TestResult } from '../domain/model/types'
import { useContainer } from './container-context'

export function useActivities() {
  const { repo } = useContainer()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(() => {
    void repo.listActivities().then((list) => {
      setActivities(list)
      setLoading(false)
    })
  }, [repo])
  useEffect(refresh, [refresh])
  return { activities, loading, refresh }
}

export function useTestResults() {
  const { repo } = useContainer()
  const [results, setResults] = useState<TestResult[]>([])
  const refresh = useCallback(() => {
    void repo.listTestResults().then(setResults)
  }, [repo])
  useEffect(refresh, [refresh])
  return { results, refresh }
}
```

- [ ] **Step 4: Verify pass; commit**

```bash
git add -A && git commit -m "feat(app): composition root with IndexedDB fallback, container context, data hooks"
```

---

### Task 6: UI components, Library screen, routing

**Files:**
- Create: `src/components/ui/button.tsx`, `src/components/ui/card.tsx`, `src/components/ui/badge.tsx`, `src/app/screens/library/ads-card.tsx`, `src/app/screens/library/ads-card.test.tsx`, `src/app/screens/library/run-list.tsx`, `src/app/screens/library/import-dropzone.tsx`, `src/app/screens/library/library-screen.tsx`, `src/app/screens/library/library-screen.test.tsx`, `src/app/screens/activity/activity-screen.tsx`
- Modify: `src/App.tsx` (routes), `src/main.tsx` (async container bootstrap)

**Interfaces:**
- Consumes: everything above plus `assessAds`, `activitySummary`, format utilities, sonner.
- Produces:
  - `Button` (variants: `default` near-white primary, `outline`, `ghost`; sizes `sm`, `default`), `Card`/`CardHeader`/`CardTitle`/`CardContent`, `Badge` (variants `outline`, `ok`, `caution`, `danger`) — vendored shadcn-style on theme tokens
  - `AdsCard({ status }: { status: AdsStatus })` — pure presentational; the signature threshold-meter readout
  - `RunList({ activities, badges }: { activities: Activity[]; badges: Map<string, string[]> })` — table rows linking to `/activity/:id`
  - `ImportDropzone({ onFiles }: { onFiles: (files: File[]) => void })` — drag-drop + click-to-browse
  - `LibraryScreen()` — composes all of it, owns import flow + toasts + session banner
  - Routes: `/` → LibraryScreen, `/activity/:id` → ActivityScreen (placeholder detail)

- [ ] **Step 1: Write the failing component tests**

`src/app/screens/library/ads-card.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AetTestResult, AntTestResult } from '../../../domain/model/types'
import { AdsCard } from './ads-card'

afterEach(cleanup)

const aet: AetTestResult = {
  kind: 'aet',
  id: 'a',
  activityId: 'act1',
  testDate: new Date('2026-06-01T08:00:00Z'),
  createdAt: new Date('2026-06-01T08:00:00Z'),
  window: { startS: 0, endS: 3600 },
  driftChannel: 'speed',
  decouplingPct: 4.2,
  windowAvgHr: 148.2,
  verdict: 'at-aet',
  aetHr: 148,
}
const ant: AntTestResult = {
  kind: 'ant',
  id: 'n',
  activityId: 'act2',
  testDate: new Date('2026-06-15T08:00:00Z'),
  createdAt: new Date('2026-06-15T08:00:00Z'),
  window: { startS: 0, endS: 1800 },
  antHr: 165,
  windowAvgHr: 163.7,
  windowAvgSpeed: null,
  windowAvgPower: null,
}

describe('AdsCard', () => {
  it('invites action when no tests exist', () => {
    render(<AdsCard status={{ state: 'no-tests' }} />)
    expect(screen.getByText(/run an aet test to begin/i)).toBeInTheDocument()
  })

  it('names the missing test', () => {
    render(<AdsCard status={{ state: 'missing-ant', aet }} />)
    expect(screen.getByText(/ant test still needed/i)).toBeInTheDocument()
  })

  it('shows gap, verdict, and provenance when assessed', () => {
    render(
      <AdsCard
        status={{
          state: 'assessed',
          gapPct: 10.303,
          ads: true,
          aet,
          ant,
          aetStale: false,
          antStale: true,
        }}
      />,
    )
    expect(screen.getByText('10.3%')).toBeInTheDocument()
    expect(screen.getByText(/aerobic deficiency/i)).toBeInTheDocument()
    expect(screen.getByText(/148 bpm/)).toBeInTheDocument()
    expect(screen.getByText(/165 bpm/)).toBeInTheDocument()
    expect(screen.getByText(/retest suggested/i)).toBeInTheDocument()
  })

  it('reports balance when under threshold', () => {
    render(
      <AdsCard
        status={{
          state: 'assessed',
          gapPct: 9.09,
          ads: false,
          aet,
          ant,
          aetStale: false,
          antStale: false,
        }}
      />,
    )
    expect(screen.getByText(/balanced/i)).toBeInTheDocument()
  })
})
```

`src/app/screens/library/library-screen.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { GarminFitFileParser } from '../../../adapters/fit/fit-file-parser'
import { InMemoryLibraryRepository } from '../../../adapters/storage/in-memory-library-repository'
import { fixtureBytes } from '../../../adapters/testing/fixtures'
import { ContainerProvider } from '../../container-context'
import { LibraryScreen } from './library-screen'

afterEach(cleanup)

function renderScreen(persistent = true) {
  const container = {
    parser: new GarminFitFileParser(),
    repo: new InMemoryLibraryRepository(),
    persistent,
  }
  render(
    <MemoryRouter>
      <ContainerProvider container={container}>
        <LibraryScreen />
      </ContainerProvider>
    </MemoryRouter>,
  )
  return container
}

describe('LibraryScreen', () => {
  it('shows empty states initially', async () => {
    renderScreen()
    expect(await screen.findByText(/no runs yet/i)).toBeInTheDocument()
    expect(screen.getByText(/run an aet test to begin/i)).toBeInTheDocument()
  })

  it('imports a dropped FIT file and lists the run', async () => {
    renderScreen()
    const bytes = fixtureBytes('Activity.fit')
    const file = new File([bytes as BlobPart], 'Activity.fit')
    const input = screen.getByTestId('file-input')
    await userEvent.upload(input as HTMLInputElement, file)
    await waitFor(() => expect(screen.getByText('2021-07-20')).toBeInTheDocument())
    expect(screen.getByText('1:00:01')).toBeInTheDocument() // durationS 3601
  })

  it('warns when storage is session-only', async () => {
    renderScreen(false)
    expect(await screen.findByText(/won't be saved/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify fail** — missing modules.

- [ ] **Step 3: Implement the vendored UI primitives**

`src/components/ui/button.tsx`:

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-mono text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-ink text-bg hover:bg-ink/90',
        outline: 'border border-line bg-transparent text-ink hover:bg-surface-2',
        ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
)
Button.displayName = 'Button'
```

`src/components/ui/card.tsx`:

```tsx
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-line bg-surface', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-4 pb-2', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        'font-mono text-xs font-semibold uppercase tracking-widest text-ink-muted',
        className,
      )}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 pt-2', className)} {...props} />
}
```

`src/components/ui/badge.tsx`:

```tsx
import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider',
  {
    variants: {
      variant: {
        outline: 'border border-line text-ink-muted',
        ok: 'bg-ok/15 text-ok',
        caution: 'bg-caution/15 text-caution',
        danger: 'bg-danger/15 text-danger',
      },
    },
    defaultVariants: { variant: 'outline' },
  },
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
```

- [ ] **Step 4: Implement the Library screen pieces**

`src/app/screens/library/ads-card.tsx` — the signature readout:

```tsx
import type { AdsStatus } from '../../../domain/analysis/ads-assessment'
import { ADS_GAP_THRESHOLD_PCT } from '../../../domain/analysis/protocol-constants'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '../../format'

const METER_MAX_PCT = 20

function ThresholdMeter({ gapPct }: { gapPct: number | null }) {
  const clamped = gapPct === null ? null : Math.max(0, Math.min(METER_MAX_PCT, gapPct))
  const redlineLeft = `${(ADS_GAP_THRESHOLD_PCT / METER_MAX_PCT) * 100}%`
  return (
    <div aria-hidden className="relative mt-3 h-2 rounded-full bg-surface-2">
      <div
        className="absolute top-[-4px] h-4 w-0.5 bg-danger/70"
        style={{ left: redlineLeft }}
      />
      {clamped !== null && (
        <div
          className="absolute top-[-3px] h-3.5 w-1 rounded-sm bg-ink transition-[left]"
          style={{ left: `calc(${(clamped / METER_MAX_PCT) * 100}% - 2px)` }}
        />
      )}
      <div className="absolute inset-x-0 top-3 flex justify-between font-mono text-[10px] text-ink-muted">
        <span>0</span>
        <span className="text-danger/80">{ADS_GAP_THRESHOLD_PCT}</span>
        <span>{METER_MAX_PCT}%</span>
      </div>
    </div>
  )
}

function Provenance({ status }: { status: Extract<AdsStatus, { state: 'assessed' }> }) {
  return (
    <div className="mt-6 space-y-1 border-t border-line pt-3 font-mono text-xs text-ink-muted">
      <p>
        AeT <span className="text-ch-hr">{status.aet.aetHr} bpm</span> ·{' '}
        {formatDate(status.aet.testDate)}
        {status.aetStale && (
          <Badge variant="caution" className="ml-2">
            retest suggested
          </Badge>
        )}
      </p>
      <p>
        AnT <span className="text-ch-hr">{status.ant.antHr} bpm</span> ·{' '}
        {formatDate(status.ant.testDate)}
        {status.antStale && (
          <Badge variant="caution" className="ml-2">
            retest suggested
          </Badge>
        )}
      </p>
    </div>
  )
}

export function AdsCard({ status }: { status: AdsStatus }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ADS readout</CardTitle>
      </CardHeader>
      <CardContent>
        {status.state === 'assessed' ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-4xl font-semibold tabular-nums">
                {status.gapPct.toFixed(1)}%
              </span>
              {status.ads ? (
                <Badge variant="danger">aerobic deficiency</Badge>
              ) : (
                <Badge variant="ok">balanced</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {status.ads
                ? 'AeT sits more than 10% below AnT. Build base, then retest.'
                : 'AeT and AnT are within 10%. High-intensity work is productive.'}
            </p>
            <ThresholdMeter gapPct={status.gapPct} />
            <Provenance status={status} />
          </>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-4xl font-semibold text-ink-muted">—</span>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {status.state === 'no-tests' && 'Run an AeT test to begin.'}
              {status.state === 'missing-aet' && 'AeT test still needed for an assessment.'}
              {status.state === 'missing-ant' && 'AnT test still needed for an assessment.'}
            </p>
            <ThresholdMeter gapPct={null} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
```

`src/app/screens/library/run-list.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { activitySummary } from '../../../domain/analysis/activity-summary'
import type { Activity } from '../../../domain/model/types'
import { Badge } from '@/components/ui/badge'
import { formatBpm, formatDate, formatDistanceKm, formatDuration, formatPace } from '../../format'

export function RunList({
  activities,
  badges,
}: {
  activities: Activity[]
  badges: Map<string, string[]>
}) {
  if (activities.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-muted">No runs yet.</p>
  }
  return (
    <table className="w-full border-collapse font-mono text-sm tabular-nums">
      <thead>
        <tr className="border-b border-line text-left text-[10px] uppercase tracking-widest text-ink-muted">
          <th className="py-2 pr-4 font-medium">date</th>
          <th className="py-2 pr-4 font-medium">sport</th>
          <th className="py-2 pr-4 font-medium">duration</th>
          <th className="py-2 pr-4 font-medium">distance</th>
          <th className="py-2 pr-4 font-medium">avg hr</th>
          <th className="py-2 pr-4 font-medium">pace</th>
          <th className="py-2 font-medium">tests</th>
        </tr>
      </thead>
      <tbody>
        {activities.map((a) => {
          const s = activitySummary(a)
          return (
            <tr key={a.id} className="border-b border-line/50 hover:bg-surface">
              <td className="py-2 pr-4">
                <Link to={`/activity/${a.id}`} className="text-ink hover:underline">
                  {formatDate(a.startTime)}
                </Link>
              </td>
              <td className="py-2 pr-4 text-ink-muted">{a.sport}</td>
              <td className="py-2 pr-4">{formatDuration(s.durationS)}</td>
              <td className="py-2 pr-4">{formatDistanceKm(s.distanceM)}</td>
              <td className="py-2 pr-4 text-ch-hr">{formatBpm(s.avgHr)}</td>
              <td className="py-2 pr-4 text-ch-pace">
                {s.avgSpeed === null ? '–' : formatPace(s.avgSpeed)}
              </td>
              <td className="py-2">
                {(badges.get(a.id) ?? []).map((b) => (
                  <Badge key={b} className="mr-1">
                    {b}
                  </Badge>
                ))}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
```

`src/app/screens/library/import-dropzone.tsx`:

```tsx
import { useRef, useState, type DragEvent } from 'react'
import { cn } from '@/lib/utils'

export function ImportDropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [active, setActive] = useState(false)

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setActive(false)
    onFiles([...e.dataTransfer.files])
  }

  // The input is a SIBLING of the button: nesting it inside would be invalid
  // HTML and input.click() would bubble back into the button's onClick.
  return (
    <div className="h-full">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setActive(true)
        }}
        onDragLeave={() => setActive(false)}
        onDrop={handleDrop}
        className={cn(
          'flex h-full min-h-32 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-center transition-colors',
          active ? 'border-focus bg-surface-2' : 'hover:border-ink-muted hover:bg-surface',
        )}
      >
        <span className="font-mono text-xs uppercase tracking-widest text-ink-muted">import</span>
        <span className="text-sm text-ink">Drop .fit or .zip files</span>
        <span className="text-xs text-ink-muted">or click to browse</span>
      </button>
      <input
        ref={inputRef}
        data-testid="file-input"
        type="file"
        accept=".fit,.zip"
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
    </div>
  )
}
```

`src/app/screens/library/library-screen.tsx`:

```tsx
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { assessAds } from '../../../domain/analysis/ads-assessment'
import { useContainer } from '../../container-context'
import { useActivities, useTestResults } from '../../hooks'
import { importFiles } from '../../import-service'
import { AdsCard } from './ads-card'
import { ImportDropzone } from './import-dropzone'
import { RunList } from './run-list'

export function LibraryScreen() {
  const { parser, repo, persistent } = useContainer()
  const { activities, refresh } = useActivities()
  const { results } = useTestResults()
  const navigate = useNavigate()

  const adsStatus = useMemo(() => assessAds(results, new Date()), [results])
  const badges = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const r of results) {
      const list = map.get(r.activityId) ?? []
      list.push(r.kind === 'aet' ? 'AeT' : 'AnT')
      map.set(r.activityId, list)
    }
    return map
  }, [results])

  const handleFiles = async (files: File[]) => {
    const payload = await Promise.all(
      files.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })),
    )
    const outcomes = await importFiles(payload, parser, repo)
    for (const o of outcomes) {
      if (o.status === 'imported') toast.success(`Imported ${o.filename}`)
      if (o.status === 'duplicate') toast.info(`${o.filename} is already in the library — opening it`)
      if (o.status === 'error') toast.error(`Couldn't read ${o.filename}: ${o.reason}`)
    }
    refresh()
    // spec §3.3: a lone duplicate import opens the existing activity
    if (outcomes.length === 1 && outcomes[0]!.status === 'duplicate') {
      navigate(`/activity/${outcomes[0]!.activityId}`)
    }
  }

  return (
    <div className="space-y-8">
      {!persistent && (
        <p className="rounded-md border border-caution/40 bg-caution/10 px-3 py-2 text-sm text-caution">
          Storage is unavailable — this session won't be saved. Runs disappear when you close the
          tab.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <AdsCard status={adsStatus} />
        <ImportDropzone onFiles={(files) => void handleFiles(files)} />
      </div>
      <section>
        <h2 className="mb-2 font-mono text-xs font-semibold uppercase tracking-widest text-ink-muted">
          Runs
        </h2>
        <RunList activities={activities} badges={badges} />
      </section>
    </div>
  )
}
```

`src/app/screens/activity/activity-screen.tsx` (placeholder until milestone 4):

```tsx
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { activitySummary } from '../../../domain/analysis/activity-summary'
import type { Activity } from '../../../domain/model/types'
import { useContainer } from '../../container-context'
import { formatBpm, formatDate, formatDistanceKm, formatDuration, formatPace } from '../../format'

export function ActivityScreen() {
  const { id } = useParams<{ id: string }>()
  const { repo } = useContainer()
  const [activity, setActivity] = useState<Activity | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    void repo.getActivity(id).then((a) => {
      setActivity(a)
      setLoading(false)
    })
  }, [repo, id])

  if (loading) return <p className="text-ink-muted">Loading…</p>
  if (!activity) {
    return (
      <p className="text-ink-muted">
        Run not found. <Link to="/" className="text-ink underline">Back to library</Link>
      </p>
    )
  }
  const s = activitySummary(activity)
  return (
    <div className="space-y-4">
      <Link to="/" className="font-mono text-xs uppercase tracking-widest text-ink-muted">
        ← library
      </Link>
      <h1 className="font-mono text-2xl tabular-nums">
        {formatDate(activity.startTime)} · {activity.sport}
      </h1>
      <p className="font-mono text-sm text-ink-muted">
        {formatDuration(s.durationS)} · {formatDistanceKm(s.distanceM)} ·{' '}
        <span className="text-ch-hr">{formatBpm(s.avgHr)}</span> ·{' '}
        <span className="text-ch-pace">{s.avgSpeed === null ? '–' : formatPace(s.avgSpeed)}</span>
      </p>
      <p className="text-sm text-ink-muted">
        The analysis workspace (charts, sectors, tests) arrives in milestone 4.
      </p>
    </div>
  )
}
```

- [ ] **Step 5: Wire routes and bootstrap**

`src/App.tsx` (full replacement — `AppShell` unchanged, `App` gains routes):

```tsx
import type { ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { BRAND, TAGLINE } from './app/brand'
import { ActivityScreen } from './app/screens/activity/activity-screen'
import { LibraryScreen } from './app/screens/library/library-screen'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header
        role="banner"
        className="flex items-baseline gap-3 border-b border-line px-6 py-3"
      >
        <span className="font-mono text-sm font-semibold uppercase tracking-[0.25em]">
          {BRAND}
        </span>
        <span className="font-mono text-xs uppercase tracking-widest text-ink-muted">
          {TAGLINE}
        </span>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<LibraryScreen />} />
        <Route path="/activity/:id" element={<ActivityScreen />} />
      </Routes>
      <Toaster theme="dark" position="bottom-right" />
    </AppShell>
  )
}
```

`src/main.tsx` — replace the render call with an async bootstrap:

```tsx
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { createContainer } from './app/container'
import { ContainerProvider } from './app/container-context'

void createContainer().then((container) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ContainerProvider container={container}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ContainerProvider>
    </StrictMode>,
  )
})
```

(The `App.test.tsx` from Task 1 keeps passing: it renders `AppShell` directly inside `MemoryRouter`.)

- [ ] **Step 6: Run all tests, full gate; commit**

Run: `npm test && npm run lint && npm run build`
Expected: all green (component tests included).

Run: `grep -rE "from 'react|from 'dexie|@garmin|document\.|window\." src/domain/`
Expected: no output.

```bash
git add -A
git commit -m "feat(app): Library screen - import dropzone, run table, ADS readout, routing, toasts"
```

---

### Task 7: Visual verification

- [ ] **Step 1:** `npm run dev`, open the app with playwright-cli, screenshot the empty library, import `tests/fixtures/user-run-2026-07-05.fit` through the real UI, screenshot the populated library and the activity detail page. Confirm: dark theme applied, mono numerals, ADS empty state, toasts fire, run row shows `2026-07-05 · running · 1:00:01 · 9.04 km · 159 bpm · 6:39 /km`.
- [ ] **Step 2:** Fix any visual defects found (spacing, contrast, focus states); re-verify; commit.

## Definition of done (milestone 3)

- Full gate green (all prior tests + new unit/component tests), purity grep clean.
- `npm run dev`: drop a FIT file → toast → run appears with correct formatted stats; duplicate drop → info toast; text file → error toast; ADS card renders empty state; activity route shows summary; session-only banner logic verified by test.
- Visual pass done with screenshots.
