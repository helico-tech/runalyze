# Everyday Run Metrics — Design

**Date:** 2026-07-06
**Status:** Approved (brainstorm) — pending implementation plan

## Motivation

The tool has strong threshold analysis (AeT, AnT, ADS, decoupling) but lacks the
everyday layer that makes that work legible to a normal runner. This feature adds
three tightly-related "everyday metrics" that share plumbing:

1. **Per-km splits** — the #1 view runners expect, currently missing.
2. **Time-in-zone** — turns the existing AeT/AnT estimates into an at-a-glance
   HR-zone bar, tying the threshold work together.
3. **Grade-Adjusted Pace (GAP)** — corrects pace for hills; a shared building
   block that splits display, and which makes HR-vs-effort honest on hilly runs.

Delivered as **one cohesive milestone** (Approach A). GAP is shared plumbing, not
a standalone toy — no chart overlay, table + summary stat only.

## Scope

**In scope:** GAP (Minetti curve), per-km splits table, time-in-zone bar, a global
manual-threshold escape hatch, and the persistence + UI to support them.

**Out of scope (YAGNI):** GAP chart overlay, mile splits, %HRmax fallback zones,
pace zones, per-run threshold overrides beyond a saved test, a dedicated settings
route, auto-updating global thresholds from the latest test.

## Section 1 — Data model & threshold resolution

### Thresholds singleton

A single global value representing the athlete's current manual thresholds:

```ts
interface Thresholds {
  aetHr: number | null // manual "current" aerobic threshold HR (bpm)
  antHr: number | null // manual "current" anaerobic threshold HR (bpm)
  updatedAt: Date
}
```

### Persistence

Extend `LibraryRepository` with:

```ts
getThresholds(): Promise<Thresholds | null>
saveThresholds(t: Thresholds): Promise<void>
```

- **Dexie:** add a `settings: 'key'` store holding a single row keyed
  `'thresholds'`. Bump the schema to `version(2)` (additive; existing stores
  unchanged, so no migration logic needed).
- **In-memory repo:** add a nullable `Thresholds` field.
- **Contract test:** one round-trip test in the shared repository contract so both
  implementations are covered.

### Resolution rule (per run)

For a given activity's zones, resolve each threshold independently:

- `aetHr` = the activity's own saved **AeT** test `aetHr` if one exists,
  **else** the global `Thresholds.aetHr`.
- `antHr` = the activity's own saved **AnT** test `antHr` if one exists,
  **else** the global `Thresholds.antHr`.

An override only applies when **the run itself is a saved test**; otherwise every
run uses the global value. If either threshold resolves to `null`, or
`aetHr >= antHr`, zones are not drawn — the panel shows an inline prompt to set
thresholds instead.

## Section 2 — Domain modules

All pure, all under `src/domain/analysis/`, each with a focused `*.test.ts`
matching existing conventions.

### `grade-adjusted-pace.ts`

Minetti energy-cost-of-running curve.

- Grade `i` = Δaltitude / Δdistance per interval, **smoothed over a rolling
  ~30 m window** to suppress GPS altitude noise.
- Cost of running `Cr(i)` = Minetti et al. (2002) fifth-order polynomial (J/kg/m):
  `Cr(i) = 155.4·i⁵ − 30.4·i⁴ − 43.3·i³ + 46.3·i² + 19.5·i + 3.6`,
  where `i` is the gradient (rise/run). Flat cost `Cr(0) = 3.6`.
- Per interval: `equivFlatDistance = actualDistance × Cr(i) / Cr(0)`.
- **GAP pace over a range** = `Σtime / ΣequivFlatDistance` (seconds per meter).
- Exposes `gradeAdjustedPace(a, range)` and a whole-run GAP stat.
- **Requires** the `distance` and `altitude` channels; returns `null` when either
  is absent.

Property to test: a flat run (constant altitude) yields GAP pace identical to real
pace.

### `splits.ts`

- Bucket the `distance` channel into 1 km boundaries; split `k` covers distance
  `[k·1000, (k+1)·1000)`, mapped back to a `TimeRange` via the nearest sample.
- Each split reuses `rangeSummary` for pace/HR, and adds GAP pace (from the module
  above) plus elevation ↑/↓ computed from the altitude channel over the split.
  When altitude is absent GAP pace is `null` for every split (the panel renders a
  dash), and elevation ↑/↓ is likewise `null`.
- The trailing partial kilometer is **flagged** (`partial: true`), not hidden.
- Metric kilometres only.
- Returns an empty list when the `distance` channel is absent.

### `zones.ts`

- Inputs: resolved `aetHr`, `antHr`, and the HR series over the **non-excluded
  range** (consistent with existing averaging conventions).
- Returns sample-weighted seconds + percentage for three buckets:
  below AeT / AeT–AnT / above AnT.
- Guards: returns an unresolved result when HR is absent or `aetHr >= antHr`.

## Section 3 — UI surfaces

Composed in `activity-screen.tsx` alongside existing panels.

### `splits-panel.tsx`

Table rendered under `LapTable`. Columns:
`# · dist · time · pace · GAP · avg HR · elev ↑↓`. The trailing partial split gets
a subtle tag reusing the existing lap-type-tag pattern. Renders nothing when there
is no `distance` channel.

### `zones-panel.tsx`

A stacked horizontal bar (three segments; cool for below-AeT through warm for
above-AnT) with a legend showing time + % per zone. Two states:

- **Resolved:** draw the bar.
- **Unresolved** (missing threshold or `aet >= ant`): inline prompt leading to the
  thresholds editor.

### Thresholds editor

An inline control living inside the zones panel — no new route, no modal:
`AeT [___] bpm   AnT [___] bpm   [Save]`. Reads and writes the **global**
`Thresholds` singleton; saving immediately re-resolves the bar. This is the manual
escape hatch: set once, every run uses it. (Trade-off accepted: global settings
live in an activity-scoped panel — fine for a single-athlete tool.)

### GAP summary stat

One line added to `StatsPanel`: run GAP pace next to average pace. No chart
overlay.

### Data wiring

A new `useThresholds` hook in `hooks.ts`, mirroring the existing `useTestResults`
pattern, provides the global value and a save action to the panels.

## Section 4 — Testing

- **Domain:**
  - GAP — flat→identity, a known grade→known factor, downhill discount.
  - Splits — synthetic distance ramp → correct buckets + flagged partial last;
    no-distance → empty list.
  - Zones — synthetic HR → correct partition; `aet >= ant` and missing-HR guards.
- **Repository:** one thresholds round-trip test in the shared contract (covers
  in-memory + Dexie).
- **UI:** render tests per panel in the existing `*.test.tsx` style — splits table
  rows, zones bar resolved + unresolved-prompt states, thresholds editor save.
- **e2e:** extend `core-journeys.spec.ts` with one flow — import a run, set
  thresholds, see the zones bar populate.

## Build order

1. Thresholds persistence (types, repo methods, Dexie store, contract test).
2. GAP domain module (shared dependency).
3. Splits domain module (depends on GAP).
4. Zones domain module + resolution helper.
5. UI panels + `useThresholds` hook + `StatsPanel` GAP stat.
6. e2e journey.
