# Run Analysis Tool — Design Spec

**Date:** 2026-07-05
**Status:** Approved design, pending implementation plan
**Wordmark:** "Runalyze" — a single brand constant (`src/app/brand.ts`). The user chose the
name knowing runalyze.com exists; renaming later stays a one-constant change.

## 1. Product overview

A browser-only (no backend) analysis tool for runners. Users import FIT files (or zipped
FIT files), analyze runs on a dark scientific dashboard, and run structured physiological
self-tests following the Uphill Athlete methodology:

- **AeT test** — aerobic threshold via heart-rate drift (Pa:HR / Pw:HR decoupling)
- **AnT test** — anaerobic threshold via 30-minute time trial
- **ADS assessment** — Aerobic Deficiency Syndrome check derived from the two tests above

Everything persists locally in the browser (IndexedDB). Runs, sectors, test results, and
notes form a **local run library** with trend views over test history and PNG export cards
sized for sharing on Strava.

**Explicitly out of scope for v1 (roadmap):** mobile/touch support, GPX/TCX import,
grade-adjusted pace (GAP), imperial units, multi-sport, cloud sync, PWA installability.

### Decisions locked during brainstorming

| Topic | Decision |
|---|---|
| Persistence | Full local run library in IndexedDB (raw bytes + normalized channels) |
| v1 scope | Tests + workspace + library + notes + trends + PNG export; desktop-first, no touch |
| Aesthetic | Dark scientific dashboard (Grafana/TrainingPeaks-like), vivid channel colors |
| Charts | uPlot with custom overlay plugins for sectors/trim handles |
| Fixtures | User's real Garmin FIT files + Garmin FIT SDK public samples |
| Architecture | Ports & adapters; pure-TS domain core; TDD |

## 2. Physiology engine (domain semantics)

All thresholds and protocol parameters live in one module,
`src/domain/analysis/protocol-constants.ts`. Nothing below is a magic number in code.

### 2.1 AeT test — heart-rate drift (decoupling)

**Protocol.** The user places a *test window* (a special sector) on the activity —
nominally 60 minutes of steady running after warmup. The window:

- must not intersect exclusion ranges (warmup/cooldown trims),
- must be ≥ `AET_MIN_WINDOW_S` = 2700 s (45 min) to produce a *saveable* result
  (live values still display below the minimum, marked "window too short"),
- default suggested length `AET_TARGET_WINDOW_S` = 3600 s (60 min).

**Computation.** The window splits at its temporal midpoint into two halves. For each
half, compute the sample-weighted means of the drift channel (speed in m/s for Pa:HR, or
power in W for Pw:HR — user-selectable) and of HR, over samples actually present
(see §2.5 on gaps). Then:

```
ratio_half = mean(output) / mean(HR)
decoupling % = (ratio_1 − ratio_2) / ratio_1 × 100
```

Positive decoupling = output per heartbeat fell in the second half (HR drifted up).

**Verdicts (Uphill Athlete bands):**

| Decoupling | Verdict | Guidance shown |
|---|---|---|
| > 5% | Above AeT | Test HR was above AeT; retest ~5 bpm lower |
| 3.5–5% | At AeT | AeT HR ≈ average HR of the test window |
| < 3.5% | At/below AeT | AeT is at least the window average HR; retest higher to bracket it |

Band edges are constants (`AET_DECOUPLING_AT_MIN` = 3.5, `AET_DECOUPLING_AT_MAX` = 5.0).
Comparisons: a value is "At AeT" when `3.5 ≤ d ≤ 5.0`.

**Saved result:** test date (activity start), window range, drift channel, decoupling %,
window average HR, verdict, and — when the verdict is "At AeT" (or the user explicitly
accepts it) — the derived **AeT HR** = window average HR.

### 2.2 AnT test — 30-minute time trial

**Protocol.** Test window = the all-out effort; must be ≥ `ANT_MIN_WINDOW_S` = 1800 s
(30 min). **AnT HR = average HR over the final `ANT_AVG_SPAN_S` = 1200 s (20 min)** of
the window (Friel-style convention used by Uphill Athlete).

**Saved result:** test date, window range, AnT HR, average pace/power over the window
(informational), window average HR.

### 2.3 ADS assessment

**Derived, never stored.** Computed from the most recent saved AeT result carrying an AeT
HR and the most recent saved AnT result:

```
gap % = (AnT_HR − AeT_HR) / AnT_HR × 100
```

| Gap | Verdict |
|---|---|
| > 10% | **ADS** — aerobic base deficient relative to anaerobic ceiling; base-build and retest |
| ≤ 10% | Balanced — high-intensity training is productive |

`ADS_GAP_THRESHOLD_PCT` = 10. The UI always shows the number, the verdict, which two test
results produced it, and their ages. A test older than `TEST_STALE_DAYS` = 90 gets a
"retest suggested" hint. States with zero or one available test render an honest empty
state, not an error.

### 2.4 Activity model and channels

- **Activity**: id (content hash), start time, duration, sport, device metadata, raw file
  bytes reference, and normalized channels.
- **Channels** (normalized at import, SI units internally): heart rate (bpm), speed (m/s),
  power (W — native or developer field, e.g. Stryd), cadence (spm), altitude (m),
  distance (m), temperature (°C). Pace is derived from speed at the UI edge; pace axes
  render inverted (faster = up).
- **Series** representation: parallel typed arrays — `t: Float64Array` (seconds relative
  to activity start) + `v: Float64Array` — stored as-is in IndexedDB (structured clone
  handles typed arrays natively). Sampling is not assumed uniform.
- **Sector**: `{ id, activityId, range: [t0, t1], label, kind: 'sector' | 'test-window' }`
  with per-sector stats computed on demand.
- **Exclusion**: warmup trim `[0, tw]` and cooldown trim `[tc, end]` ranges; all whole-run
  statistics respect them.
- **Note**: `{ activityId, text, updatedAt }`, autosaved.
- **TestResult**: `{ id, activityId, kind: 'aet' | 'ant', params (window, channel),
  outputs (decoupling %, aetHr / antHr, window avg HR), verdict, createdAt }`.

### 2.5 Gaps, pauses, and averaging

Recordings contain auto-pause gaps and sensor dropouts. All averages are
**sample-weighted over samples actually present** in the range: each sample weighs the
time span it covers (delta to next sample), and spans longer than `GAP_THRESHOLD_S` = 60 s
are treated as gaps and contribute no weight. A test window containing gaps totalling more
than `MAX_GAP_IN_WINDOW_S` = 120 s is flagged in the UI ("recording gaps in window") but
still computes. This is documented behavior, not an implementation detail: silently
averaging across a long stop produces garbage decoupling numbers.

### 2.6 Auto-suggested test window

When a test flow opens, the app suggests a window: slide a window of the protocol's target
length over the non-excluded span and pick the position minimizing the standard deviation
of HR; ties resolve to the earliest position. Windows containing flagged gaps are skipped
when a gap-free alternative exists. The user can always move/resize the suggestion.

## 3. Architecture

Ports & adapters. **`src/domain/` imports nothing from React, the DOM, Dexie, or the
Garmin SDK.** Dependency arrows point inward only.

```
src/
  domain/
    model/               # Activity, Series, Sector, Exclusion, TestResult, Note
    analysis/            # stats.ts (weighted means, halves), decoupling.ts,
                         # aet-protocol.ts, ant-protocol.ts, ads-assessment.ts,
                         # window-suggestion.ts, protocol-constants.ts
    ports/               # ActivityFileParser, LibraryRepository, ImageRenderer, Clock
  adapters/
    fit/                 # @garmin/fitsdk + fflate → ParsedActivity[]
    storage/             # Dexie implementation of LibraryRepository
    export/              # DOM node → PNG via html-to-image
  app/
    brand.ts             # wordmark constant
    container.ts         # composition root: builds adapters, exposes via one context
    charts/              # uPlot React wrapper + overlay plugins (crosshair sync,
                         # sector bands, drag/resize, trim handles)
    screens/             # Library, Workspace, Trends
    components/          # shadcn-based UI
    stores/              # Zustand workspace store
  ui/                    # shadcn primitives (generated)
tests/fixtures/          # real + public FIT files + fixtures-manifest.md
e2e/                     # Playwright specs
```

### 3.1 Ports

- **`ActivityFileParser`** — `(bytes: Uint8Array, filename: string) → Promise<ParseOutcome[]>`.
  Array because a zip may contain multiple FITs; each entry is either a normalized
  `ParsedActivity` or a structured error (filename + reason). The Garmin SDK's message
  soup is normalized entirely inside the adapter; the domain never sees `record_mesgs`.
- **`LibraryRepository`** — CRUD for activities (raw bytes + channels), sectors, test
  results, notes; list queries for the library and trends screens. Dedupe: `getByHash`.
- **`ImageRenderer`** — `(node: HTMLElement, opts) → Promise<Blob>`; isolated because DOM
  rasterization is a flaky dependency worth swapping/mocking.
- **`Clock`** — `now(): Date`; deterministic tests for `createdAt`/staleness.

### 3.2 Wiring and state

- Composition root `app/container.ts` instantiates the four adapters and provides them
  through a single React context. No DI framework.
- **Zustand** store holds workspace UI state: open activity id, visible channels, drift
  channel selection, in-progress sector drags, selected sector. Persisted data flows
  through repository-backed hooks. Domain functions are pure; the store calls them, never
  the reverse.

### 3.3 Persistence

- Dexie database, schema version 1, with explicit migration discipline from day one.
- Stores: `activities` (metadata + channels + raw bytes + warmup/cooldown exclusion
  ranges), `sectors`, `testResults`, `notes`. Exclusions live on the activity record —
  they are per-activity singletons, not a list worth its own store.
- Import pipeline: bytes → SHA-256 content hash → if hash exists, surface "already in
  library, opening it" and open the existing activity → else parse, normalize, persist.
- If IndexedDB is unavailable (private browsing, quota), the app runs session-only with a
  persistent warning banner; saves fail soft with an explanation.

## 4. UI & UX

**Visual direction:** dark scientific dashboard. Near-black layered surfaces, fine
gridlines, monospace numerals for data, vivid consistent channel colors (HR red/coral,
pace cyan, power violet, cadence amber, altitude muted green) used identically in charts,
stats, and export cards. shadcn/ui as the component base with an opinionated dark theme;
one accent color for interactive elements, channel colors reserved for data.

### 4.1 Library (home)

- Import dropzone (click or drag; accepts .fit and .zip; multi-file).
- **ADS status card** front and center: gap %, verdict, source tests with ages, staleness
  nags, honest empty states ("Run an AeT test to begin").
- Run list: date, duration, distance, avg HR, avg pace, badges for saved test results.
  Click → Workspace.

### 4.2 Workspace (per activity)

- **Stacked synced uPlot panes**, one per visible channel; shared x-axis (elapsed time),
  shared crosshair with hover readout of all channel values at the cursor.
- **Channel toggle rail**: which channels display; which channel (pace/power) drives
  ratio calculations. Channels absent from the file show disabled with a tooltip.
- **Sector editing on the charts**: drag on empty chart space to create a sector; drag
  edges to resize, body to move; sectors render as translucent bands across all panes;
  delete via keyboard or sector chip. Implemented as uPlot overlay plugins.
- **Trim handles**: grip handles anchored at both ends; excluded regions shade dark.
- **Stats panel**: whole run (respecting exclusions); per sector — avg/max per channel,
  first-half vs second-half split table, decoupling % for the selected sector (always
  visible, no test flow required).
- **Notes panel**: textarea, autosaved on debounce.
- **Test actions**: "AeT test" / "AnT test" buttons open the test side panel.

### 4.3 Test side panel (guided sector placement, not a modal wizard)

Steps within a side panel while the charts stay live:

1. Confirm drift channel (AeT only; AnT always uses HR).
2. Place/adjust the test window — auto-suggested per §2.6; the window is a special sector
   using the same editing mechanics.
3. **Live verdict while dragging**: decoupling % (or AnT HR), band, UA guidance text,
   window-too-short / gap warnings. This immediate feedback is the product's core moment.
4. Save result → persists a TestResult, badge appears in library, ADS recomputes.

### 4.4 Trends

Small-multiple charts over saved test history: AeT HR, AnT HR, decoupling %, ADS gap %
with the 10% threshold line drawn. Dots with connecting lines — no smoothing over sparse
data.

### 4.5 Export

From any saved test result or the ADS card: preview of a dark branded export card —
headline verdict, key numbers, miniature test-window chart with halves shaded — at
1200×630 logical px (OG/social ratio), rasterized at 2× via the `ImageRenderer` port,
downloaded as PNG.

## 5. Error handling

- **Corrupt/truncated FIT, zip without FITs** → per-file toast with filename and reason;
  a bad file never blocks the rest of a multi-import.
- **Missing channels** → honest degradation: no HR = test flows unavailable with an
  explanation; no power = Pw:HR option disabled with tooltip, not hidden.
- **IndexedDB unavailable** → session-only mode with persistent banner (§3.3).
- **Duplicate import** → open existing entry (§3.3).
- **Absurd inputs** (10-second activity, 14-hour ultra, non-monotonic timestamps from
  device bugs) → parser normalizes (drops non-monotonic samples) or rejects with a
  message; test flows refuse to save below protocol minimum windows rather than emit a
  confident nonsense verdict.

Guiding rule: **confident nonsense is the one failure mode a physiology tool is never
allowed to have.** Every number the app shows either meets its protocol's validity
conditions or carries a visible caveat.

## 6. Testing strategy

TDD throughout, inside-out:

- **Domain (Vitest, pure)** — bulk of the suite. Decoupling math against analytically
  constructed series with known answers (e.g., constant pace with second-half HR raised by
  factor 1/0.95 ⇒ decoupling exactly 5.0; note HR "+5%" gives 1 − 1/1.05 ≈ 4.76, not 5.0). Verdict bands at boundaries (3.49/3.5/5.0/5.01). Weighted
  averaging with deliberate gaps and dropouts. Window suggestion on synthetic profiles.
  ADS with zero/one/two tests and staleness.
- **Adapters** — FIT parser against real fixtures (user's runs: one long steady run, one
  with power, one zipped export) plus Garmin FIT SDK samples; asserts channel shapes,
  units, developer-field power, zip and multi-file handling. Storage adapter on
  `fake-indexeddb` including dedupe and migration path.
- **Components (Testing Library)** — logic-bearing components only: channel selector
  state, stats formatting, test panel verdict rendering. No snapshot spam.
- **E2E (Playwright)** — the journeys that are the product:
  1. Import fixture → trim warmup → AeT flow → verdict equals the fixture's hand-verified
     expected value → save.
  2. Import second fixture → AnT flow → ADS card shows the expected gap.
  3. Notes survive a reload.
  4. Export produces a PNG (existence + dimensions).
- **Fixture manifest rule**: every E2E fixture's expected values (decoupling %, AnT HR,
  ADS gap) are computed once independently and recorded in
  `tests/fixtures/fixtures-manifest.md` *before* the tests exist. Tests assert against
  the manifest, never against whatever the code happens to output.
- During development, interactive UI/UX passes with `playwright-cli` complement — never
  replace — the scripted suite.

## 7. Tech stack

| Concern | Choice |
|---|---|
| Build/app | Vite, React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4, shadcn/ui, dark theme |
| Charts | uPlot + custom overlay plugins (thin React wrapper) |
| FIT decode | @garmin/fitsdk (official; handles developer fields) |
| Zip | fflate |
| Storage | Dexie (IndexedDB), fake-indexeddb in tests |
| State | Zustand + repository hooks |
| Image export | html-to-image |
| Unit/component tests | Vitest, @testing-library/react |
| E2E | Playwright |
| Lint/format | ESLint (typescript-eslint, react-hooks) + Prettier |

Metric units only in v1 (SI internally, min/km pace display).

## 8. Roadmap (post-v1)

Mobile/touch sector editing, GPX/TCX import, grade-adjusted pace (GAP) as a derived
channel, imperial units, multi-sport (uphill hiking), zone derivation from AeT/AnT,
PWA/offline install, optional cloud sync.
