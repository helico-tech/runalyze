# Milestone 6: PNG Export, Delete Affordances, E2E & Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export a branded, Strava-shareable PNG of an AeT/AnT result (verdict, numbers, a mini test-window chart with halves shaded) or the ADS readout; delete runs and test results (with confirmation); and lock the product behind a Playwright E2E suite covering the core journeys.

**Architecture:** A new `ImageRenderer` port (spec §3.1) with an `html-to-image` adapter (browser-only; a fake renderer in tests). Export cards are presentational SVG/DOM, jsdom-tested; the mini chart reuses `trends-geometry`. Delete affordances use `repo.deleteActivity` (cascades) and `repo.deleteTestResult` behind inline confirm buttons. E2E uses `@playwright/test` against the dev server.

**Tech Stack:** html-to-image 1.11.x (DOM → PNG), @playwright/test 1.61.x (E2E).

## Spike facts (verified 2026-07-05)

- `html-to-image` exports `toBlob`, `toPng`, `toCanvas`; `toBlob(node, opts)` → `Promise<Blob | null>`.
- `@playwright/test` 1.61.1 runs against the cached chromium headless shell (trivial spec passes). Config points `webServer` at `npm run dev`.

## Addresses user feedback (2026-07-05)

- Export "AeT graphs for Strava" → the export card + flow.
- "can't delete runs" → delete on library run rows (confirm).
- "can't delete tests" → delete in a Trends test-log (confirm).

## Review amendments (apply during execution — supersede the task bodies below)

1. **Container.renderer ripple (Task 1, blocker):** `renderer` stays REQUIRED on `Container`. Update the three existing test container literals to include `renderer: new FakeImageRenderer()`: `library-screen.test.tsx` (`makeContainer`), `activity-screen.test.tsx` (`renderAt`'s spread + its param type), `trends-screen.test.tsx` (`renderTrends`). Import `FakeImageRenderer` per relative depth.
2. **TestPanel/AdsCard renderer is OPTIONAL (Task 3):** declare `renderer?: ImageRenderer` on both. Gate the Export button on `renderer && evaluation` (TestPanel) / `status.state === 'assessed' && renderer` (AdsCard). This leaves their existing tests (which omit `renderer`) compiling untouched. `Workspace` passes `useContainer().renderer` to TestPanel; `LibraryScreen` passes it to AdsCard.
3. **Export size 1200×630 (Task 2, spec §4.5):** `EXPORT_W = 1200`, `EXPORT_H = 630` (OG ratio), not 1080².
4. **ExportPreview full-size capture (Task 3):** render the card ONCE at intrinsic 1200×630 inside a `transform: scale(0.45); transform-origin: top left` wrapper within a `width:540 height:284 overflow:hidden` box. html-to-image captures the card node's own layout size (unaffected by the ancestor transform), so the PNG is full-size while the preview is visually scaled — no width override on the card.
5. **downloadBlob robustness (Task 3):** `document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 0)`.
6. **E2E DB-clear race (Task 5):** clear IndexedDB before the app opens it — `await page.addInitScript(() => indexedDB.deleteDatabase('runalyze'))` then `page.goto('/')`, instead of delete-then-reload.

## Global Constraints

- All prior Global Constraints apply (strict TS, domain purity grep incl. `from 'uplot'`/`from 'zustand'`/`from 'html-to-image'`, TDD, commit style, `@/` alias, jsdom docblock, `TZ: 'UTC'`).
- The `ImageRenderer` port lives in `src/domain/ports/` (types only). The adapter is in `src/adapters/export/`.
- E2E specs live in `e2e/`; they are NOT picked up by vitest (`include` stays `src/**`), and Playwright only runs `e2e/**` (its own `testDir`).

---

### Task 1: ImageRenderer port + html-to-image adapter + container

**Files:**
- Create: `src/domain/ports/image-renderer.ts`, `src/adapters/export/html-image-renderer.ts`, `src/adapters/export/fake-image-renderer.ts`
- Modify: `src/app/container.ts`, `src/app/container.test.ts`, `package.json` (install html-to-image)

**Interfaces:**
- `image-renderer.ts`: `interface ImageRenderer { toPngBlob(node: HTMLElement): Promise<Blob> }`
- `html-image-renderer.ts`: `class HtmlImageRenderer implements ImageRenderer` — wraps `htmlToImage.toBlob(node, { pixelRatio: 2, cacheBust: true })`, throws if the blob is null.
- `fake-image-renderer.ts`: `class FakeImageRenderer implements ImageRenderer` — returns a tiny fixed PNG blob; records the last node. Used in component tests and as the node-env fallback.
- `Container` gains `renderer: ImageRenderer`. `createContainer` uses `HtmlImageRenderer` in the browser; when `document` is unavailable (node tests) it uses `FakeImageRenderer`.

- [x] **Step 1: Install html-to-image**

```bash
npm install html-to-image
```

- [x] **Step 2: Write the failing test**

Append to `src/app/container.test.ts`:

```ts
import { FakeImageRenderer } from '../adapters/export/fake-image-renderer'

it('provides a renderer', async () => {
  const c = await createContainer()
  expect(c.renderer).toBeInstanceOf(FakeImageRenderer) // node env has no document
  const blob = await c.renderer.toPngBlob(undefined as unknown as HTMLElement)
  expect(blob.type).toBe('image/png')
})
```

- [x] **Step 3: Implement**

`src/domain/ports/image-renderer.ts`:

```ts
export interface ImageRenderer {
  /** Rasterize a DOM node to a PNG blob. */
  toPngBlob(node: HTMLElement): Promise<Blob>
}
```

`src/adapters/export/html-image-renderer.ts`:

```ts
import * as htmlToImage from 'html-to-image'
import type { ImageRenderer } from '../../domain/ports/image-renderer'

export class HtmlImageRenderer implements ImageRenderer {
  async toPngBlob(node: HTMLElement): Promise<Blob> {
    const blob = await htmlToImage.toBlob(node, { pixelRatio: 2, cacheBust: true })
    if (!blob) throw new Error('image rendering produced no data')
    return blob
  }
}
```

`src/adapters/export/fake-image-renderer.ts`:

```ts
import type { ImageRenderer } from '../../domain/ports/image-renderer'

// 1x1 transparent PNG bytes.
const PNG_1PX = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
])

export class FakeImageRenderer implements ImageRenderer {
  lastNode: HTMLElement | null = null
  async toPngBlob(node: HTMLElement): Promise<Blob> {
    this.lastNode = node
    return new Blob([PNG_1PX as BlobPart], { type: 'image/png' })
  }
}
```

In `container.ts`: add `renderer: ImageRenderer` to `Container`; import both adapters; set `const renderer = typeof document === 'undefined' ? new FakeImageRenderer() : new HtmlImageRenderer()` and include it in both the persistent and fallback return objects.

- [x] **Step 4: Verify pass; commit**

```bash
git add -A && git commit -m "feat(export): ImageRenderer port, html-to-image adapter, fake renderer, container wiring"
```

---

### Task 2: Export cards (presentational)

**Files:**
- Create: `src/app/export/export-card.tsx`, `src/app/export/export-card.test.tsx`

**Interfaces:**
- `EXPORT_W = 1080`, `EXPORT_H = 1080` constants.
- `TestExportCard({ activity, result })` — a branded dark square card: brand wordmark, run date, big verdict (AeT: decoupling % + band; AnT: AnT HR), key numbers (AeT HR / window avg HR, drift channel), and a mini chart of the drift channel + HR over the result's window with the two halves shaded and a midpoint line (reuse `scalePoints`/`polyline`).
- `AdsExportCard({ status })` — the ADS readout rendered for export (gap %, verdict, the threshold meter, provenance), reusing the visual language of the library `AdsCard`.
- Both render at the fixed export size with `data-export-card` on the root.

- [x] **Step 1: Write the failing test**

`src/app/export/export-card.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AetTestResult } from '../../domain/model/types'
import { syntheticActivity, syntheticSeries } from '../../domain/testing/synthetic'
import { AdsExportCard, TestExportCard } from './export-card'

afterEach(cleanup)

const aet: AetTestResult = {
  kind: 'aet',
  id: 'a1',
  activityId: 'test-activity',
  testDate: new Date('2026-07-05T06:45:13.000Z'),
  createdAt: new Date('2026-07-05T09:00:00.000Z'),
  window: { startS: 0, endS: 3600 },
  driftChannel: 'speed',
  decouplingPct: 3.56,
  windowAvgHr: 159,
  verdict: 'at-aet',
  aetHr: 159,
}

function activity() {
  return syntheticActivity({
    durationS: 3600,
    channels: {
      heartRate: syntheticSeries({ durationS: 3600, value: () => 159 }),
      speed: syntheticSeries({ durationS: 3600, value: () => 2.5 }),
    },
  })
}

describe('TestExportCard', () => {
  it('renders the verdict, numbers, and brand', () => {
    render(<TestExportCard activity={activity()} result={aet} />)
    expect(screen.getByText(/runalyze/i)).toBeInTheDocument()
    expect(screen.getByText('3.6%')).toBeInTheDocument()
    expect(screen.getByText(/at aet/i)).toBeInTheDocument()
    expect(screen.getByText(/159 bpm/)).toBeInTheDocument()
    expect(screen.getByText('2026-07-05')).toBeInTheDocument()
  })
})

describe('AdsExportCard', () => {
  it('renders the gap and verdict', () => {
    render(
      <AdsExportCard
        status={{ state: 'assessed', gapPct: 8.2, ads: false, aet, ant: { ...aet, kind: 'ant', antHr: 173, windowAvgHr: 170, windowAvgSpeed: null, windowAvgPower: null } as never, aetStale: false, antStale: false }}
      />,
    )
    expect(screen.getByText('8.2%')).toBeInTheDocument()
    expect(screen.getByText(/balanced/i)).toBeInTheDocument()
  })
})
```

- [x] **Step 2: Run to verify fail** — missing module.

- [x] **Step 3: Implement** `src/app/export/export-card.tsx`

Build both components with the theme's literal hex colors (inline styles, since html-to-image rasterizes computed styles; Tailwind classes also work but inline hex is safest for export fidelity). The mini chart: take the drift channel and HR series clipped to `result.window`, sample to ~120 points, `scalePoints` into a small box, draw two `polyline`s (HR in `#ff6b6b`, drift in `#4cc9f0`), shade the first/second halves with translucent rects, draw the midpoint line. Header: `BRAND` + `formatDate(result.testDate)`. Body: for AeT, `${decouplingPct.toFixed(1)}%` + verdict label + `AeT HR ${aetHr} bpm`; for AnT, `${antHr} bpm` + "AnT HR". Use `formatBpm`/`formatDate`. Root `<div data-export-card style={{ width: EXPORT_W, height: EXPORT_H, background: '#0b0e14', color: '#e6ebf0' }}>`. (The card is rendered into an off-screen container by the preview in Task 3 — it does not need to fit the viewport.)

`AdsExportCard` mirrors the library `AdsCard` visual (gap %, verdict badge, threshold meter, provenance) at export size with inline hex.

- [x] **Step 4: Verify pass; commit**

```bash
git add -A && git commit -m "feat(export): branded AeT/AnT and ADS export cards with mini window chart"
```

---

### Task 3: Export preview + download flow

**Files:**
- Create: `src/app/export/export-preview.tsx`, `src/app/export/download.ts`, `src/app/export/export-preview.test.tsx`
- Modify: `src/app/screens/activity/test-panel.tsx` (Export button), `src/app/screens/library/ads-card.tsx` (Export button)

**Interfaces:**
- `download.ts`: `downloadBlob(blob: Blob, filename: string): void` — object-URL + anchor click (guarded for non-DOM).
- `export-preview.tsx`: `ExportPreview({ children, filename, renderer, onClose })` — renders `children` (the card) scaled-to-fit inside a modal with a "Download PNG" button that rasterizes the card node via `renderer.toPngBlob` and calls `downloadBlob`; and a Close button. On successful download shows a "saved" state.
- `TestPanel` gains an "Export" button (always available when there's a valid evaluation) that opens an `ExportPreview` wrapping `<TestExportCard activity result={previewResult} />`, where `previewResult` is built from the live evaluation (same `buildAetResult`/`buildAntResult` path, not persisted).
- The library `AdsCard` gains an "Export" button when `status.state === 'assessed'` that opens an `ExportPreview` wrapping `<AdsExportCard status={status} />`.
- The `renderer` comes from `useContainer().renderer`.

- [x] **Step 1: Write the failing test**

`src/app/export/export-preview.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FakeImageRenderer } from '../../adapters/export/fake-image-renderer'
import { ExportPreview } from './export-preview'

afterEach(cleanup)

describe('ExportPreview', () => {
  it('rasterizes the card and reports success', async () => {
    const renderer = new FakeImageRenderer()
    render(
      <ExportPreview filename="test.png" renderer={renderer} onClose={vi.fn()}>
        <div data-export-card>card</div>
      </ExportPreview>,
    )
    await userEvent.click(screen.getByRole('button', { name: /download png/i }))
    await waitFor(() => expect(renderer.lastNode).not.toBeNull())
    expect(await screen.findByText(/saved/i)).toBeInTheDocument()
  })

  it('closes', async () => {
    const onClose = vi.fn()
    render(
      <ExportPreview filename="x.png" renderer={new FakeImageRenderer()} onClose={onClose}>
        <div data-export-card>card</div>
      </ExportPreview>,
    )
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [x] **Step 2: Run to verify fail** — missing modules.

- [x] **Step 3: Implement**

`download.ts`:

```ts
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

`export-preview.tsx`:

```tsx
import { useRef, useState, type ReactNode } from 'react'
import type { ImageRenderer } from '../../domain/ports/image-renderer'
import { Button } from '@/components/ui/button'
import { downloadBlob } from './download'

export function ExportPreview({
  children,
  filename,
  renderer,
  onClose,
}: {
  children: ReactNode
  filename: string
  renderer: ImageRenderer
  onClose: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const download = async () => {
    const node = cardRef.current?.firstElementChild as HTMLElement | undefined
    if (!node) return
    setBusy(true)
    try {
      downloadBlob(await renderer.toPngBlob(node), filename)
      setSaved(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg/90 p-6">
      <div className="max-h-[70vh] max-w-[70vw] overflow-auto rounded-lg border border-line">
        {/* the card renders at full export size; scaled visually by max-w/max-h */}
        <div ref={cardRef} className="[&>*]:!h-auto [&>*]:!w-[540px]">
          {children}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button size="sm" disabled={busy} onClick={() => void download()}>
          Download PNG
        </Button>
        {saved && <span className="font-mono text-xs text-ok">saved</span>}
      </div>
    </div>
  )
}
```

> Note: the preview scales the card down for display via a wrapper class, but `toPngBlob` rasterizes the actual card node at its intrinsic export size (the `!w-[540px]` override is display-only and applies to the wrapper's child; since `toPngBlob` reads the card node's own layout, keep the card's intrinsic size — html-to-image captures the node's real dimensions). During execution, verify the exported PNG is full-size in the browser pass; if the display override leaks into the capture, render the card off-screen at full size (position: fixed; left: -99999px) and preview a separate scaled copy.

Wire the Export buttons: in `TestPanel`, add an "Export" `Button` (in the footer row) that sets local `showExport` state; when true, build `previewResult` from the current evaluation and render `<ExportPreview filename={...} renderer={renderer} onClose={() => setShowExport(false)}><TestExportCard activity={activity} result={previewResult} /></ExportPreview>`. Pass `renderer` into `TestPanel` as a prop from `Workspace` (`useContainer().renderer`). In `ads-card.tsx`, add an "Export" button when assessed that opens the preview with `<AdsExportCard status={status} />`; `AdsCard` takes a `renderer` prop from `LibraryScreen`.

- [x] **Step 4: Full gate; commit**

Run: `npm test && npm run lint && npm run build`. Purity grep clean.

```bash
git add -A && git commit -m "feat(export): preview modal, PNG download, wired into test panel and ADS card"
```

---

### Task 4: Delete runs + delete tests (confirmed)

**Files:**
- Create: `src/app/components/confirm-button.tsx`, `src/app/components/confirm-button.test.tsx`
- Modify: `src/app/screens/library/run-list.tsx`, `src/app/screens/library/library-screen.tsx`, `src/app/screens/trends/trends-screen.tsx`

**Interfaces:**
- `ConfirmButton({ label, confirmLabel, onConfirm })` — a two-step inline confirm: first click shows `confirmLabel` (caution-styled) + reverts after 3s or on blur; second click calls `onConfirm`. Used for destructive actions without a modal.
- `RunList` gains an `onDelete(id)` prop; each row has a `ConfirmButton` (stopPropagation) that calls it. `LibraryScreen` passes `onDelete = async (id) => { await repo.deleteActivity(id); refresh() }`.
- `TrendsScreen` gains a "test log" section under the charts: a list of every result (date, kind, key value) each with a `ConfirmButton` delete that calls `repo.deleteTestResult(id)` then re-reads results via `useTestResults().refresh`.

- [x] **Step 1: Write the failing tests**

`src/app/components/confirm-button.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmButton } from './confirm-button'

afterEach(cleanup)

describe('ConfirmButton', () => {
  it('requires two clicks to confirm', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmButton label="Delete" confirmLabel="Confirm?" onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm?' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
```

Append a delete test to `src/app/screens/activity/activity-screen.test.tsx` is not needed; instead extend the library test — append to `src/app/screens/library/library-screen.test.tsx`:

```tsx
it('deletes a run after confirmation', async () => {
  const container = makeContainer(true)
  const { activity } = // build+save one activity
    await (async () => {
      const parser = container.parser
      const [o] = await parser.parse(fixtureBytes('Activity.fit'), 'Activity.fit')
      if (!o!.ok) throw new Error('parse')
      await container.repo.saveActivity(o!.activity, o!.rawBytes)
      return { activity: o!.activity }
    })()
  render(
    <MemoryRouter>
      <ContainerProvider container={container}>
        <LibraryScreen />
      </ContainerProvider>
    </MemoryRouter>,
  )
  await screen.findByText('2021-07-20')
  await userEvent.click(screen.getByRole('button', { name: /delete run/i }))
  await userEvent.click(screen.getByRole('button', { name: /confirm/i }))
  await waitFor(async () => expect(await container.repo.listActivities()).toHaveLength(0))
  void activity
})
```

(Import `fixtureBytes` and `waitFor` at the top of that test file if not already present.)

- [x] **Step 2: Run to verify fail** — missing `ConfirmButton`, no delete affordance.

- [x] **Step 3: Implement**

`confirm-button.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className,
}: {
  label: string
  confirmLabel: string
  onConfirm: () => void
  className?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        if (armed) {
          onConfirm()
          setArmed(false)
        } else {
          setArmed(true)
        }
      }}
      className={cn(
        'rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider',
        armed ? 'border-danger/60 text-danger' : 'border-line text-ink-muted hover:text-ink',
        className,
      )}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
```

- `RunList`: add `onDelete?: (id: string) => void` prop; add a trailing `<td>` per row with `<ConfirmButton label="Delete run" confirmLabel="Confirm delete" onConfirm={() => onDelete?.(a.id)} />` and add a header cell. `LibraryScreen` passes `onDelete`.
- `TrendsScreen`: below the chart grid (still inside the `max-w-5xl` wrapper), render a "Test log" list from `results` sorted newest-first: each row shows `formatDate(testDate)`, kind (AeT/AnT), the key value (AeT decoupling % / AnT HR), and a `ConfirmButton label="Delete" confirmLabel="Confirm"` calling `repo.deleteTestResult(r.id)` then `refresh()`. Get `repo` from `useContainer()` and `refresh` from `useTestResults()`.

- [x] **Step 4: Full gate; commit**

```bash
git add -A && git commit -m "feat(library,trends): delete runs and test results with inline confirmation"
```

---

### Task 5: Playwright E2E suite

**Files:**
- Create: `playwright.config.ts`, `e2e/core-journeys.spec.ts`
- Modify: `package.json` (install `@playwright/test`, add `test:e2e` script), `.gitignore` (playwright artifacts)

**Interfaces:**
- `playwright.config.ts`: `testDir: 'e2e'`, `webServer: { command: 'npm run dev', port: 5173, reuseExistingServer: true }`, one chromium project, `use: { baseURL: 'http://localhost:5173' }`.
- `e2e/core-journeys.spec.ts`: the journeys that are the product.

- [x] **Step 1: Install and configure**

```bash
npm install -D @playwright/test
```

`package.json` scripts: add `"test:e2e": "playwright test"`. `.gitignore`: add `test-results` and `playwright-report`.

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  reporter: 'line',
  use: { baseURL: 'http://localhost:5173', trace: 'off' },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
```

- [x] **Step 2: Write the E2E spec**

`e2e/core-journeys.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const fixture = (name: string) =>
  fileURLToPath(new URL(`../tests/fixtures/${name}`, import.meta.url))

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => indexedDB.deleteDatabase('runalyze'))
  await page.reload()
})

test('import a run, run an AeT test, and see the verdict', async ({ page }) => {
  await page.setInputFiles('[data-testid=file-input]', fixture('user-run-2026-07-05.fit'))
  await page.getByText('2026-07-05').click()
  await page.waitForSelector('.u-over')
  await page.getByRole('button', { name: 'AeT test' }).click()
  await expect(page.getByText('At AeT')).toBeVisible()
  await expect(page.getByText('3.6%')).toBeVisible()
})

test('a saved test drives the ADS readout and Trends', async ({ page }) => {
  await page.setInputFiles('[data-testid=file-input]', fixture('user-run-2026-07-05.fit'))
  await page.getByText('2026-07-05').click()
  await page.waitForSelector('.u-over')
  await page.getByRole('button', { name: 'AeT test' }).click()
  await page.getByRole('button', { name: 'Save result' }).click()
  await page.getByRole('link', { name: 'Trends' }).click()
  await expect(page.getByText('AeT HR')).toBeVisible()
})

test('notes and sectors persist across reload', async ({ page }) => {
  await page.setInputFiles('[data-testid=file-input]', fixture('user-run-2026-07-05.fit'))
  await page.getByText('2026-07-05').click()
  await page.waitForSelector('.u-over')
  await page.getByRole('textbox').fill('tempo effort')
  await page.waitForTimeout(700) // debounce
  await page.reload()
  await expect(page.getByRole('textbox')).toHaveValue('tempo effort')
})

test('export produces a PNG download', async ({ page }) => {
  await page.setInputFiles('[data-testid=file-input]', fixture('user-run-2026-07-05.fit'))
  await page.getByText('2026-07-05').click()
  await page.waitForSelector('.u-over')
  await page.getByRole('button', { name: 'AeT test' }).click()
  await page.getByRole('button', { name: 'Export' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /download png/i }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/\.png$/)
})
```

- [x] **Step 3: Run E2E**

Run: `npm run test:e2e`
Expected: 4 passed. (If the environment cannot launch the browser, record the failure and the reason; the specs remain the durable regression suite.)

- [x] **Step 4: Commit**

```bash
git add -A && git commit -m "test(e2e): Playwright suite covering import, AeT verdict, ADS/Trends, persistence, export"
```

---

### Task 6: Final verification + README

**Files:**
- Create: `README.md`

**Interfaces:** —

- [x] **Step 1:** Write a concise `README.md`: what Runalyze is, the ports-&-adapters layout, `npm run dev|test|build|test:e2e`, and the fixtures/manifest discipline. Keep it short.
- [x] **Step 2:** Full gate: `npm test && npm run lint && npm run build`, purity grep, and `npm run test:e2e`. Then `npm run dev` + a playwright-cli pass: run an AeT test, click Export, confirm the preview shows the branded card and the PNG downloads; delete a test from Trends and a run from the Library. Screenshot the export card.
- [x] **Step 3:** Fix defects; commit.

## Definition of done (milestone 6)

- Full gate green (export/delete/confirm tests + all prior), purity grep clean.
- E2E suite present; `npm run test:e2e` passes (or the environment limitation is documented).
- In-browser: AeT/AnT/ADS export to a branded PNG; runs and tests are deletable with confirmation.
- README committed.
