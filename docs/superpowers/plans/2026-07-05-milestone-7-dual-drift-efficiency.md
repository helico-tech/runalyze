# Milestone 7: Dual-Drift AeT + Efficiency Curves — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop the drift-metric selector; the AeT test computes and shows BOTH Pa:HR (pace) and Pw:HR (power) decoupling with per-channel verdicts, storing both (AeT HR accepted when *either* reads at-AeT). Add efficiency-curve chart panes (speed/HR and power/HR over time) to the workspace.

**Architecture:** `AetTestResult` gains per-channel `pace`/`power` results (dropping the single `driftChannel`/`decouplingPct`/`verdict`); `aetHr`/`windowAvgHr` stay, so `assessAds` is untouched. `evaluateAetTest(activity, window)` computes both channels. Efficiency is a new pure domain module (`efficiency.ts`) rendered as extra uPlot panes via computed series.

**Tech Stack:** nothing new.

## Decision (user, 2026-07-05)

"Store both verdicts": save both Pa:HR and Pw:HR decoupling + verdicts; the AeT HR (window avg HR) is accepted whenever EITHER channel reads at-AeT.

## Global Constraints

- All prior Global Constraints apply (strict TS, domain purity grep, TDD, commit style, `@/` alias, jsdom docblock, `TZ: 'UTC'`, no uPlot in vitest).
- Migration note: this changes the persisted `AetTestResult` shape. There is no production data; existing local IndexedDB test results become stale — acceptable (dev-only). No migration code.

---

### Task 1: Domain — nearestIndex move + efficiency module

**Files:**
- Modify: `src/domain/model/series.ts`, `src/domain/model/series.test.ts`, `src/app/screens/activity/channel-values.ts` (re-use the moved `nearestIndex`), `src/app/screens/activity/channel-values.test.ts` (drop the moved test or keep a re-export test)
- Create: `src/domain/analysis/efficiency.ts`, `src/domain/analysis/efficiency.test.ts`

**Interfaces:**
- Move `nearestIndex(t: Float64Array, target: number): number` from `channel-values.ts` into `series.ts` (domain) and export it there; `channel-values.ts` imports it from the domain instead of defining it. (channel-values stays in the app layer; it just consumes the domain helper.)
- `efficiency.ts`:
  - `efficiencySeries(output: Series, hr: Series, scale: number): Series` — for each HR sample with finite `hr > 0`, value = `scale * outputNearest / hr` where `outputNearest` is the output sample nearest that HR timestamp (via `nearestIndex`); samples with no finite output or `hr ≤ 0` are skipped. Timestamps are the retained HR sample times.
  - `rollingMean(series: Series, windowS: number): Series` — centered moving average over a `±windowS/2` time window (same timestamps; each point averaged over neighbours within the window). Empty in → empty out.

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/model/series.test.ts`:

```ts
import { nearestIndex } from './series'

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
```

(`makeSeries` is already imported at the top of that test file.)

`src/domain/analysis/efficiency.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { makeSeries } from '../model/series'
import { syntheticSeries } from '../testing/synthetic'
import { efficiencySeries, rollingMean } from './efficiency'

describe('efficiencySeries', () => {
  it('computes scaled output/HR at HR timestamps', () => {
    const speed = syntheticSeries({ durationS: 4, value: () => 3 }) // 3 m/s
    const hr = syntheticSeries({ durationS: 4, value: () => 150 })
    const ef = efficiencySeries(speed, hr, 60) // m/min per bpm
    expect(ef.t.length).toBe(4)
    expect(ef.v[0]).toBeCloseTo((60 * 3) / 150, 9) // 1.2
  })

  it('aligns output to the nearest HR timestamp', () => {
    const output = makeSeries([0, 10], [2, 4])
    const hr = makeSeries([0, 4, 9], [100, 100, 100])
    const ef = efficiencySeries(output, hr, 1)
    // hr@0 → output idx0 (2), hr@4 → nearest output idx0 (2), hr@9 → output idx1 (4)
    expect(Array.from(ef.v)).toEqual([2 / 100, 2 / 100, 4 / 100])
  })

  it('skips samples with non-positive or non-finite HR', () => {
    const output = syntheticSeries({ durationS: 3, value: () => 3 })
    const hr = makeSeries([0, 1, 2], [150, 0, NaN])
    const ef = efficiencySeries(output, hr, 1)
    expect(ef.t.length).toBe(1)
    expect(ef.t[0]).toBe(0)
  })
})

describe('rollingMean', () => {
  it('smooths within the time window', () => {
    const s = makeSeries([0, 1, 2, 3, 4], [0, 10, 0, 10, 0])
    const m = rollingMean(s, 2) // ±1s window
    expect(m.v[0]).toBeCloseTo(5, 6) // mean(0,10)
    expect(m.v[1]).toBeCloseTo(10 / 3, 6) // mean(0,10,0)
    expect(m.v[2]).toBeCloseTo(20 / 3, 6) // mean(10,0,10)
  })

  it('returns empty for empty input', () => {
    expect(rollingMean(makeSeries([], []), 2).t.length).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement.**

In `series.ts`, add (binary search, same logic that was in channel-values):

```ts
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
  if (lo > 0 && Math.abs(t[lo - 1]! - target) <= Math.abs(t[lo]! - target)) return lo - 1
  return lo
}
```

In `channel-values.ts`, delete the local `nearestIndex` and `import { nearestIndex } from '../../../domain/model/series'`. Remove the now-duplicated `nearestIndex` test from `channel-values.test.ts` (the domain test covers it); keep the `channelValuesAt` test.

`src/domain/analysis/efficiency.ts`:

```ts
import { makeSeries, nearestIndex } from '../model/series'
import type { Series } from '../model/types'

export function efficiencySeries(output: Series, hr: Series, scale: number): Series {
  const t: number[] = []
  const v: number[] = []
  for (let i = 0; i < hr.t.length; i++) {
    const h = hr.v[i]!
    if (!Number.isFinite(h) || h <= 0) continue
    const oi = nearestIndex(output.t, hr.t[i]!)
    if (oi < 0) continue
    const o = output.v[oi]!
    if (!Number.isFinite(o)) continue
    t.push(hr.t[i]!)
    v.push((scale * o) / h)
  }
  return makeSeries(t, v)
}

export function rollingMean(series: Series, windowS: number): Series {
  const { t, v } = series
  const n = t.length
  const out = new Float64Array(n)
  const half = windowS / 2
  let lo = 0
  let hi = 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    while (lo < n && t[lo]! < t[i]! - half) {
      sum -= v[lo]!
      lo++
    }
    while (hi < n && t[hi]! <= t[i]! + half) {
      sum += v[hi]!
      hi++
    }
    out[i] = sum / (hi - lo)
  }
  return { t: Float64Array.from(t), v: out }
}
```

> Note: the sliding-window sum assumes `lo`/`hi` only advance forward, which holds because `t` is strictly increasing and the window bounds move monotonically with `i`. Verify the `rollingMean` test values match.

- [ ] **Step 4: Verify pass; commit.**

```bash
git add -A && git commit -m "feat(domain): efficiency series + rolling mean; move nearestIndex to the domain"
```

---

### Task 2: Domain — dual-channel AeT model + protocol

**Files:**
- Modify: `src/domain/model/types.ts`, `src/domain/analysis/aet-protocol.ts`, `src/domain/analysis/aet-protocol.test.ts`

**Interfaces:**
- `types.ts`: replace the AeT result fields:

```ts
export interface AetChannelResult {
  decouplingPct: number
  verdict: AetVerdict
}

export interface AetTestResult {
  kind: 'aet'
  id: string
  activityId: string
  testDate: Date
  createdAt: Date
  window: TimeRange
  /** Pa:HR (speed drift) — null when speed is absent */
  pace: AetChannelResult | null
  /** Pw:HR (power drift) — null when power is absent */
  power: AetChannelResult | null
  windowAvgHr: number
  /** window avg HR, set when either channel is at-aet (or the user accepted); integer bpm */
  aetHr: number | null
}
```

(Keep `DriftChannel` exported; it is still used by `efficiencySeries` callers indirectly and by `evaluateAetTest`'s internals only if needed. If it becomes unused after this milestone, leave the type — removing it is out of scope.)

- `aet-protocol.ts`:
  - `interface AetChannelEval { decoupling: DecouplingResult; verdict: AetVerdict }`
  - `AetEvaluation` becomes:

```ts
export interface AetEvaluation {
  pace: AetChannelEval | null
  power: AetChannelEval | null
  windowAvgHr: number
  warnings: AetWarning[]
  valid: boolean
  atAet: boolean
  suggestedAetHr: number | null
}
```

  - `evaluateAetTest(activity: Activity, window: TimeRange): AetEvaluation` — throws `Error(/missing channel: heartRate/)` when HR absent, and `Error(/no drift channel/)` when neither speed nor power present. Computes `pace` from speed (if present) and `power` from power (if present). `warnings`/`valid` as before (too-short / overlaps-exclusion invalidate; gaps warn — gaps computed from whichever channels are present, worst uncovered). `atAet = pace?.verdict === 'at-aet' || power?.verdict === 'at-aet'`. `suggestedAetHr = atAet ? Math.round(windowAvgHr) : null`.
  - `buildAetResult(args)` — drop `driftChannel`; build `pace`/`power` `AetChannelResult` (or null) from the evaluation; `aetHr = evaluation.suggestedAetHr ?? (args.acceptAetHr ? Math.round(evaluation.windowAvgHr) : null)`.

- [ ] **Step 1: Rewrite the failing tests** (`aet-protocol.test.ts`) — the test activity has both speed and HR; add a variant with power. Assert `evaluateAetTest(a, WINDOW)` returns `pace.decoupling.decouplingPct ≈ 5.0`, `pace.verdict === 'at-aet'`, `atAet === true`, `suggestedAetHr === 154`; the warnings/validity cases unchanged (now without the driftChannel arg); the missing-channel case throws `/no drift channel/` when neither speed nor power present; `buildAetResult` stores `pace`/`power` and sets `aetHr` per the either-at-aet rule.

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement** the model + protocol changes.

- [ ] **Step 4: Verify pass; commit.**

```bash
git add -A && git commit -m "feat(domain): AeT stores both Pa:HR and Pw:HR verdicts; evaluate computes both channels"
```

---

### Task 3: Update all AetTestResult consumers + literals

**Files:**
- Modify: `src/domain/analysis/ads-assessment.test.ts`, `src/adapters/storage/library-repository-contract.ts`, `src/app/screens/library/ads-card.test.tsx`, `src/app/screens/trends/trends-screen.tsx` + `.test.tsx`, `src/app/export/export-card.tsx` + `.test.tsx`, `src/app/screens/activity/activity-screen.tsx` (testKeyValue)

**Interfaces / edits:**
- Every `AetTestResult` object literal drops `driftChannel`/`decouplingPct`/`verdict` and adds `pace: { decouplingPct, verdict }` and `power: null` (or a value). Keep `windowAvgHr`/`aetHr`.
- `trends-screen.tsx`: the "AeT decoupling" series uses `r.pace?.decouplingPct ?? r.power?.decouplingPct` (skip nulls); `testKeyValue` for aet → e.g. `${r.pace ? 'Pa ' + r.pace.decouplingPct.toFixed(1) + '%' : ''}${r.power ? ' · Pw ' + r.power.decouplingPct.toFixed(1) + '%' : ''} · ${formatBpm(r.aetHr)}` (trim).
- `activity-screen.tsx` `testKeyValue`: same dual formatting for aet.
- `export-card.tsx` `TestExportCard`: for aet, show both Pa:HR and Pw:HR decoupling (each with its verdict label) instead of a single decoupling/verdict; the headline is the pace decoupling if present else power, and a small line lists both. Update the export-card test assertions accordingly (assert both `3.6%` for pace and the power value render).
- `ads-assessment.test.ts` / `library-repository-contract.ts` / `ads-card.test.tsx`: update the AeT literals to the new shape (they only need `aetHr` for ADS; set `pace: { decouplingPct: 4.2, verdict: 'at-aet' }, power: null`).

- [ ] **Step 1:** Update the literals + consumers.
- [ ] **Step 2:** `npm test && npm run lint && npm run build` — all green.
- [ ] **Step 3: Commit.**

```bash
git add -A && git commit -m "refactor: update all AetTestResult consumers to dual-channel shape"
```

---

### Task 4: Remove drift selector; dual-verdict panels

**Files:**
- Modify: `src/app/screens/activity/workspace-store.ts` + `.test.ts`, `src/app/screens/activity/activity-screen.tsx`, `src/app/screens/activity/test-panel.tsx` + `.test.tsx`, `src/app/screens/activity/stats-panel.tsx` + `.test.tsx`, `src/app/channels.ts` (remove `driftChannelLabel`)

**Edits:**
- `workspace-store.ts`: remove `driftChannel` state + `setDriftChannel` action (and from `WorkspaceState` + `init`). Update `workspace-store.test.ts` (drop the driftChannel assertions / setDriftChannel test).
- `activity-screen.tsx`: remove the drift `<span>…</span>` selector block; remove `driftChannel` from the `useZustand` reads; stop passing `driftChannel` to `TestPanel`/`StatsPanel`.
- `test-panel.tsx`: drop the `driftChannel` prop; `evaluateAetTest(activity, window)`; the AeT body renders BOTH `pace` and `power` (each: decoupling % + verdict badge + guidance), or "—" when a channel is null; the accept checkbox shows when `!evaluation.atAet && evaluation.valid`; `buildAetResult` no longer takes `driftChannel`. Update `test-panel.test.tsx` (remove `driftChannel` prop; assert both channels; `getByText('At AeT', { exact: true })` where needed).
- `stats-panel.tsx`: drop the `driftChannel` prop; the sector block shows BOTH Pa:HR and Pw:HR decoupling (guarded "—" when the channel or HR is missing). Update `stats-panel.test.tsx`.
- `channels.ts`: remove `driftChannelLabel` (now unused).

- [ ] **Step 1:** Apply edits (tests first where they change assertions).
- [ ] **Step 2:** `npm test && npm run lint && npm run build` — all green. Purity grep clean.
- [ ] **Step 3: Commit.**

```bash
git add -A && git commit -m "feat(workspace): remove drift selector; AeT + stats show both Pa:HR and Pw:HR"
```

---

### Task 5: Efficiency chart panes

**Files:**
- Modify: `src/app/channels.ts` (efficiency display metas), `src/app/screens/activity/workspace-store.ts` (include efficiency keys in `visible`), `src/app/screens/activity/chart-stack.tsx` (build efficiency panes), `src/app/screens/activity/activity-screen.tsx` (rail includes efficiency toggles), `src/app/screens/activity/channel-values.ts` (hover includes efficiency)

**Design:**
- Add an `EFFICIENCY` list in `channels.ts`: two entries `efPace` (label "Pa:HR eff", colorHex `#2dd4bf`, from speed, scale 60) and `efPower` (label "Pw:HR eff", colorHex `#c084fc`, from power, scale 1), each with `format: (v) => v.toFixed(2)` and a `requires: ChannelKind` (speed / power). `efficiencyPresent(activity): EfficiencyMeta[]` returns those whose `requires` channel AND heartRate are present.
- The `DisplayChannel` union gains `'efPace' | 'efPower'`. `channelsPresent`/`init` include efficiency keys (so panes show by default). `visible` holds them.
- `chart-stack.tsx`: build efficiency panes alongside raw ones — for each visible efficiency meta, compute `rollingMean(efficiencySeries(activity.channels[requires]!, activity.channels.heartRate!, scale), 30)` (memoized in the effect) and render a pane with the meta's color/format; the sector/trim/hover overlays apply identically (they read time, not channel). Efficiency panes are not inverted.
- `activity-screen.tsx` rail: append efficiency toggle buttons (same styling) after the raw channel buttons.
- `channel-values.ts`: extend `channelValuesAt` to append efficiency readouts (compute EF at the nearest sample) so the hover bar shows them too. (Keep it pure — pass the activity; compute the two EF values at `tS`.)

- [ ] **Step 1:** Write/adjust tests: `channels.test.ts` asserts `efficiencyPresent` returns both when speed+power+HR present, none without HR; `channel-values.test.ts` asserts an efficiency value appears at a cursor time; `workspace-store.test.ts` visible set includes `efPace`/`efPower`.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** `npm test && npm run lint && npm run build` — all green. Purity grep clean (efficiency compute lives in domain; chart-stack imports domain fns).
- [ ] **Step 4: Commit.**

```bash
git add -A && git commit -m "feat(workspace): Pa:HR and Pw:HR efficiency-curve chart panes with hover readout"
```

---

### Task 6: Visual verification

- [ ] **Step 1:** `npm run dev`; playwright-cli: open the user run's workspace. Confirm: the drift selector is gone; the AeT test panel shows BOTH Pa:HR (3.6%, At AeT) and Pw:HR (2.4%, Below AeT) with per-channel verdicts; two efficiency-curve panes (Pa:HR eff, Pw:HR eff) render and toggle from the rail; the hover readout shows efficiency values; saving stores both (Trends test log shows both decouplings). Screenshot the dual-verdict panel and the efficiency curves.
- [ ] **Step 2:** Fix defects; re-verify; commit.

## Definition of done (milestone 7)

- Full gate green (efficiency/dual-AeT/updated-consumer tests + all prior), purity grep clean, E2E still passes (`npm run test:e2e`).
- In-browser: no drift selector; AeT shows both Pa:HR + Pw:HR verdicts and stores both; efficiency curves render and toggle.
