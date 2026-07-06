# Design-language adoption — "Relay / Job Queue Console" → Runalyze

Date: 2026-07-06

## Goal

Adopt the visual design language of the "Job Queue Console" reference design across
Runalyze, without importing its job-queue domain semantics. Full re-skin: tokens +
primitives + all screens, light **and** dark themes with a toggle, full font swap.

## What we adopt (the language)

- **Fonts**: IBM Plex Sans (UI) + JetBrains Mono (numbers/IDs/code).
- **Surfaces**: neutral near-black dark palette layered as `bg` → `panel` → `panel2`
  with a darker `sunk` inset; two border weights (`bd`, `bd2`). Mirror light palette.
- **Accent**: violet (`#7c74ff` dark / `#5148e0` light) as the brand/CTA accent, plus
  `accent-soft` tint.
- **Component vocabulary**: pill badges with a leading status dot; mono on every
  number/ID; uppercase micro-labels with letter-spacing; sparkline stat cards; dense
  grid tables with hover rows; tight radius scale (6–14px).

## What we do NOT adopt

- The job-queue status colors (queued/running/succeeded/failed/retrying/dead). Runalyze
  keeps its own semantic palette — chart channels (hr/pace/power/cadence/altitude) and
  verdict states (ok/caution/danger) — retuned to work in both themes.

## Mechanism

- `index.css`: `@theme inline` maps each `--color-*` to a raw `var(--x)`. Raw values
  live in `:root` (dark default) and `:root[data-theme='light']` (light override).
  Existing utilities (`bg-bg`, `text-ink-muted`, …) keep working and become
  theme-reactive with zero markup churn; old token names kept as aliases of the new
  raw vars during migration.
- `useTheme` hook: localStorage-persisted, writes `data-theme` on `<html>`. Header
  toggle button. `Toaster theme` wired to it.

## Order

1. Tokens + fonts (everything rides on these).
2. Primitives (badge / button / card) — existing tests stay green.
3. App shell + theme toggle.
4. Screens one at a time (Activity → Library → Trends). Presentation only, no logic.

## Verification

- vitest + playwright suites stay green throughout.
- Review agent audits after each meaningful chunk.
- Visual check in **both** themes via Playwright screenshots. uPlot chart colors wired
  to the theme (the fiddliest part).
