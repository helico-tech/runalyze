# Runalyze

A browser-only (no backend) analysis tool for runners. Import FIT files, analyze runs on a
dark scientific dashboard, and run structured physiological self-tests following the
[Uphill Athlete](https://uphillathlete.com) methodology:

- **AeT test** — aerobic threshold via heart-rate drift (Pa:HR / Pw:HR decoupling)
- **AnT test** — anaerobic threshold via a 30-minute time trial
- **ADS assessment** — Aerobic Deficiency Syndrome check derived from the two

Everything persists locally in the browser (IndexedDB). Runs, sectors, test results, and
notes form a local run library with trend charts over test history and branded PNG export
cards sized for sharing.

## Commands

```bash
npm install
npm run dev        # start the dev server (http://localhost:5173)
npm test           # unit + component tests (Vitest)
npm run lint       # ESLint
npm run build      # typecheck (tsc) + production build (Vite)
npm run test:e2e   # Playwright end-to-end journeys
```

## Architecture — ports & adapters

```
src/
  domain/       pure TypeScript: model, analysis (protocol constants, decoupling,
                AeT/AnT/ADS, stats), and ports (interfaces only)
  adapters/     fit (Garmin SDK + fflate), storage (Dexie), export (html-to-image)
  app/          React shell, screens (library / workspace / trends), export, components
tests/fixtures/ real FIT files + fixtures-manifest.md (expected values computed
                independently, before the tests that assert them)
e2e/            Playwright specs
```

`src/domain/` imports nothing from React, the DOM, Dexie, uPlot, or the Garmin SDK —
dependency arrows point inward only. Charts are uPlot; workspace state is Zustand; styling
is Tailwind v4 with an opinionated dark theme (tokens in `src/index.css`).

## Physiology

All protocol thresholds live in `src/domain/analysis/protocol-constants.ts` — nothing in
the engine is a magic number. Averages are sample-weighted over samples actually present,
so recording gaps and auto-pauses don't corrupt decoupling numbers. Test-fixture expected
values are hand-computed in `tests/fixtures/fixtures-manifest.md` before any test asserts
them, so the suite tests reality rather than enshrining whatever the code happens to emit.

Built with [Claude Code](https://claude.com/claude-code).
