# Milestone 2: FIT & Storage Adapters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real FIT files (single, zipped, corrupt) decode into normalized domain `Activity` objects and persist through a Dexie-backed `LibraryRepository`, proven by an integration test that runs the full AeT pipeline on the user's real run.

**Architecture:** Two ports (`ActivityFileParser`, `LibraryRepository`) defined in `src/domain/ports/` (types only — domain purity holds), implemented by adapters in `src/adapters/fit/` (@garmin/fitsdk + fflate) and `src/adapters/storage/` (Dexie). Fixtures are real files with independently computed expected values recorded in `tests/fixtures/fixtures-manifest.md` **before** the tests that assert them.

**Tech Stack:** @garmin/fitsdk (v21.x), fflate, dexie, fake-indexeddb (tests), Web Crypto SHA-256.

## Facts established by pre-plan spike (2026-07-05, SDK 21.208.0)

These are observations, not assumptions — the plan's code relies on them:

- `import { Decoder, Stream } from '@garmin/fitsdk'`; `Stream.fromByteArray(bytes)`; `decoder.isFIT()`, `decoder.checkIntegrity()`, `decoder.read()` → `{ messages, errors }`. Package ships its own `src/index.d.ts`.
- Records are `messages.recordMesgs`: camelCase fields, `timestamp` is a JS `Date`. Speed/altitude may appear as `enhancedSpeed`/`enhancedAltitude` (preferred) and/or `speed`/`altitude`.
- **Developer fields:** `record.developerFields` is keyed by the field description's `key` property (NOT `fieldDefinitionNumber`). Match descriptions via `fieldDescriptionMesgs` entries (`fieldName`, `units`, `key`). The user's FR255+Stryd file carries power ONLY as developer field `fieldName: 'Power', units: 'Watts', key: 7` — no native power.
- `sessionMesgs` can be entirely absent (WithGearChangeData.fit) → fall back to record timestamps for start/duration and `'unknown'` sport.
- `fake-indexeddb` exports named `IDBFactory` and `IDBKeyRange`; Dexie accepts `new Dexie(name, { indexedDB, IDBKeyRange })` and round-trips `Float64Array` and `Date` losslessly.
- `crypto.subtle` is available in Node ≥ 20 test env and browsers.

## Global Constraints

- Everything from the milestone-1 plan's Global Constraints still applies (strict TS, purity grep, TDD, commit style).
- `src/domain/ports/**` may contain **types/interfaces only** — no runtime imports beyond domain model types.
- Adapters may import from `src/domain/`; never the reverse.
- Fixture expected values come from `tests/fixtures/fixtures-manifest.md` — tests must assert manifest numbers, never numbers derived by running the adapter itself.
- The user-run fixture contains personal data (GPS traces); this repo is private-local. Do not publish fixtures.

---

### Task 1: Fixtures, manifest, dependencies

**Files:**
- Create: `tests/fixtures/Activity.fit`, `tests/fixtures/HrmPluginTestActivity.fit`, `tests/fixtures/WithGearChangeData.fit`, `tests/fixtures/user-run-2026-07-05.fit`, `tests/fixtures/activities.zip`, `tests/fixtures/corrupt.fit`, `tests/fixtures/not-a-fit.txt`, `tests/fixtures/fixtures-manifest.md`
- Delete: `fit-files/` (user's drop folder, file moves into fixtures)
- Modify: `package.json` (deps via npm install)

**Interfaces:**
- Consumes: nothing.
- Produces: fixture files + manifest used by Tasks 2–5. Dependencies `@garmin/fitsdk`, `fflate`, `dexie` (runtime); `fake-indexeddb`, `@types/node` (dev).

- [ ] **Step 1: Provision fixture files**

```bash
mkdir -p tests/fixtures
for f in Activity.fit HrmPluginTestActivity.fit WithGearChangeData.fit; do
  curl -sL -o "tests/fixtures/$f" "https://raw.githubusercontent.com/garmin/fit-javascript-sdk/main/test/data/$f"
done
mv fit-files/23484026958_ACTIVITY.fit tests/fixtures/user-run-2026-07-05.fit
rmdir fit-files
cd tests/fixtures && zip -j activities.zip Activity.fit WithGearChangeData.fit && head -c 512 Activity.fit > corrupt.fit && echo "this is not a fit file" > not-a-fit.txt && cd ../..
ls -la tests/fixtures/
```

Expected: 8 files present (7 fixtures + manifest comes next step).

- [ ] **Step 2: Write the fixtures manifest**

`tests/fixtures/fixtures-manifest.md`:

```markdown
# Fixtures Manifest

Expected values computed independently on 2026-07-05 via a standalone spike script
(@garmin/fitsdk 21.208.0, plain unweighted means over finite channel values), BEFORE any
adapter code existed. Tests assert these numbers; they were not produced by the code
under test. "avg" = plain mean; all series are 1 Hz with maxDt = 1 s (no gaps) unless
noted.

## Activity.fit (Garmin fit-javascript-sdk test data)

- records: 3601, startTime 2021-07-20T21:11:20.000Z, lastRelT 3600 s, monotonic
- session: sport standUpPaddleboarding, totalElapsedTime 3601
- fileId: manufacturer "development", no garminProduct → device "development"
- developer fields present ("Doughnuts Earned", "Heart Rate") — native HR also present
- channels (n / avg / max): heartRate 3601 / 126.5096 / 254 · power 3601 / 199.764 / 250
  · cadence 3601 / 126.0358 / 254 · distance 3601 / 1800 / 3600 · speed 3601 / 1 (constant)
  · altitude 3601 / 64.1644 · temperature absent

## HrmPluginTestActivity.fit (Garmin fit-javascript-sdk test data)

- records: 310, startTime 2022-08-29T18:31:22.000Z, lastRelT 309 s, monotonic
- session: sport walking, totalElapsedTime 309 · device fr955
- channels: heartRate 310 / 72.8613 / 93 · temperature 310 / 26.3065 / 28
  · speed 310 / 0.0687 · altitude 310 / 1585.2877 · power absent

## WithGearChangeData.fit (Garmin fit-javascript-sdk test data)

- records: 1979, startTime 2022-06-22T23:08:37.000Z, lastRelT 1978 s, monotonic
- **no sessionMesgs, no sportMesgs** → sport falls back to "unknown", durationS to 1978
- device edge1040 · native power present: 1979 / 120.4987 / 534
- channels: heartRate 1979 / 105.186 / 136 · cadence 1954 samples (sparser than records)

## user-run-2026-07-05.fit (user's Garmin FR255 + Stryd; PERSONAL DATA — private repo only)

- records: 3602, startTime 2026-07-05T06:45:13.000Z, lastRelT 3601 s, monotonic, maxDt 1
- session: sport running, totalElapsedTime 3600.873, avgHeartRate 159 · device fr255
- **no native power** — power is developer field {fieldName "Power", units "Watts", key 7}
- channels: heartRate 3602 (avg 159.0147) · speed (enhancedSpeed) 3602 / 2.5059
  · power (developer) 3602 / 213.5053, first value 221 · cadence 3602 · altitude 3602
  · distance 3602 · temperature absent
- hand-computed decoupling over window [0, 3600), halves at 1800 (plain per-half means):
  - Pa:HR — halves 2.4829/154.6639 and 2.5291/163.3567 → **decoupling 3.5606 %**
  - Pw:HR — halves 210.2950/154.6639 and 216.7206/163.3567 → **decoupling 2.4284 %**
  - window [0, 3600) plain avg HR: **159.0103** (n=3600)

## activities.zip

- zip of Activity.fit + WithGearChangeData.fit (entries keep those names)

## corrupt.fit / not-a-fit.txt

- corrupt.fit: first 512 bytes of Activity.fit (valid header, fails integrity)
- not-a-fit.txt: plain text (fails isFIT)

## Adding your own fixtures

Drop additional real runs here, extend this manifest with independently computed facts
BEFORE writing tests that use them (decode with a standalone script, record the numbers).
```

- [ ] **Step 3: Install dependencies**

```bash
npm install @garmin/fitsdk fflate dexie
npm install -D fake-indexeddb @types/node
```

Expected: exit 0.

- [ ] **Step 4: Verify existing gates still pass**

Run: `npm test && npm run lint && npm run build`
Expected: all green (58 tests, no new code yet).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: FIT fixtures with independently computed manifest, adapter dependencies"
```

---

### Task 2: Ports, SHA-256 hashing, FIT decode adapter

**Files:**
- Create: `src/domain/ports/activity-file-parser.ts`, `src/domain/ports/library-repository.ts`, `src/adapters/fit/hash.ts`, `src/adapters/fit/decode-fit.ts`, `src/adapters/testing/fixtures.ts`, `src/adapters/fit/hash.test.ts`, `src/adapters/fit/decode-fit.test.ts`

**Interfaces:**
- Consumes: `Activity`, `ChannelKind`, `Series`, `Exclusions`, `Sector`, `TestResult`, `Note`, `TimeRange` types; `makeSeries`, `defaultExclusions` (milestone 1).
- Produces:
  - `type ParseOutcome = { ok: true; filename: string; activity: Activity; rawBytes: Uint8Array } | { ok: false; filename: string; reason: string }`
  - `interface ActivityFileParser { parse(bytes: Uint8Array, filename: string): Promise<ParseOutcome[]> }`
  - `interface LibraryRepository` — full method set (see code below), consumed by Task 4.
  - `sha256Hex(bytes: Uint8Array): Promise<string>`
  - `class FitDecodeError extends Error`
  - `decodeFitActivity(bytes: Uint8Array, id: string): Activity` — throws `FitDecodeError` on invalid input
  - `fixtureBytes(name: string): Uint8Array` (test helper reading `tests/fixtures/`)

Normalization rules (spec §2.4/§5, spike facts): startTime = session start else first record timestamp; per-record relative `t = (ts − startTime)/1000`, records with missing timestamps, `t < 0`, or non-increasing `t` are dropped; channel values must be finite numbers; `speed = enhancedSpeed ?? speed`; `altitude = enhancedAltitude ?? altitude`; `power = native ?? developer-field power` (description with `fieldName === 'Power'` and Watts units, looked up by its `key`); `durationS = session.totalElapsedTime ?? lastRelT`; `sport = session ?? sportMesgs ?? 'unknown'`; `device = String(garminProduct ?? manufacturer) ?? null`; channels with zero samples are omitted; an activity with zero channels is an error.

- [ ] **Step 1: Write the failing tests**

`src/adapters/testing/fixtures.ts`:

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export function fixtureBytes(name: string): Uint8Array {
  const path = fileURLToPath(new URL(`../../../tests/fixtures/${name}`, import.meta.url))
  return new Uint8Array(readFileSync(path))
}
```

`src/adapters/fit/hash.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { sha256Hex } from './hash'

describe('sha256Hex', () => {
  it('computes the well-known hash of "abc"', async () => {
    const bytes = new TextEncoder().encode('abc')
    expect(await sha256Hex(bytes)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('is deterministic and content-sensitive', async () => {
    const a = new Uint8Array([1, 2, 3])
    expect(await sha256Hex(a)).toBe(await sha256Hex(new Uint8Array([1, 2, 3])))
    expect(await sha256Hex(a)).not.toBe(await sha256Hex(new Uint8Array([1, 2, 4])))
  })
})
```

`src/adapters/fit/decode-fit.test.ts` (all expected numbers from `tests/fixtures/fixtures-manifest.md`):

```ts
import { describe, expect, it } from 'vitest'
import type { Series } from '../../domain/model/types'
import { fixtureBytes } from '../testing/fixtures'
import { decodeFitActivity, FitDecodeError } from './decode-fit'

const plainMean = (s: Series) => Array.from(s.v).reduce((a, b) => a + b, 0) / s.v.length

describe('decodeFitActivity', () => {
  it('normalizes Activity.fit per the manifest', () => {
    const a = decodeFitActivity(fixtureBytes('Activity.fit'), 'id-1')
    expect(a.id).toBe('id-1')
    expect(a.startTime.toISOString()).toBe('2021-07-20T21:11:20.000Z')
    expect(a.durationS).toBe(3601)
    expect(a.sport).toBe('standUpPaddleboarding')
    expect(a.device).toBe('development')
    expect(a.exclusions).toEqual({ warmupEndS: 0, cooldownStartS: 3601 })
    const hr = a.channels.heartRate!
    expect(hr.t.length).toBe(3601)
    expect(plainMean(hr)).toBeCloseTo(126.5096, 3)
    expect(a.channels.power!.t.length).toBe(3601)
    expect(plainMean(a.channels.power!)).toBeCloseTo(199.764, 2)
    expect(plainMean(a.channels.speed!)).toBeCloseTo(1, 9)
    expect(plainMean(a.channels.altitude!)).toBeCloseTo(64.1644, 3)
    expect(a.channels.temperature).toBeUndefined()
    // relative timestamps: first 0, last 3600
    expect(hr.t[0]).toBe(0)
    expect(hr.t[hr.t.length - 1]).toBe(3600)
  })

  it('maps developer-field power (Stryd) when no native power exists', () => {
    const a = decodeFitActivity(fixtureBytes('user-run-2026-07-05.fit'), 'id-2')
    expect(a.sport).toBe('running')
    expect(a.device).toBe('fr255')
    expect(a.durationS).toBeCloseTo(3600.873, 3)
    const power = a.channels.power!
    expect(power.t.length).toBe(3602)
    expect(power.v[0]).toBe(221)
    expect(plainMean(power)).toBeCloseTo(213.5053, 3)
    expect(plainMean(a.channels.heartRate!)).toBeCloseTo(159.0147, 3)
    expect(plainMean(a.channels.speed!)).toBeCloseTo(2.5059, 3)
  })

  it('falls back gracefully when session messages are absent', () => {
    const a = decodeFitActivity(fixtureBytes('WithGearChangeData.fit'), 'id-3')
    expect(a.sport).toBe('unknown')
    expect(a.durationS).toBe(1978)
    expect(a.device).toBe('edge1040')
    expect(plainMean(a.channels.power!)).toBeCloseTo(120.4987, 3)
    // cadence is sparser than records — channels are independent
    expect(a.channels.cadence!.t.length).toBe(1954)
    expect(a.channels.heartRate!.t.length).toBe(1979)
  })

  it('extracts temperature when present', () => {
    const a = decodeFitActivity(fixtureBytes('HrmPluginTestActivity.fit'), 'id-4')
    expect(a.sport).toBe('walking')
    expect(a.device).toBe('fr955')
    expect(a.channels.temperature!.t.length).toBe(310)
    expect(plainMean(a.channels.temperature!)).toBeCloseTo(26.3065, 3)
  })

  it('rejects a truncated FIT file', () => {
    expect(() => decodeFitActivity(fixtureBytes('corrupt.fit'), 'id-5')).toThrow(FitDecodeError)
  })

  it('rejects a non-FIT file', () => {
    expect(() => decodeFitActivity(fixtureBytes('not-a-fit.txt'), 'id-6')).toThrow(FitDecodeError)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./hash` / `./decode-fit`.

- [ ] **Step 3: Implement**

`src/domain/ports/activity-file-parser.ts`:

```ts
import type { Activity } from '../model/types'

export type ParseOutcome =
  | { ok: true; filename: string; activity: Activity; rawBytes: Uint8Array }
  | { ok: false; filename: string; reason: string }

export interface ActivityFileParser {
  /** One outcome per contained activity: a zip yields one outcome per .fit entry. */
  parse(bytes: Uint8Array, filename: string): Promise<ParseOutcome[]>
}
```

`src/domain/ports/library-repository.ts`:

```ts
import type { Activity, Exclusions, Note, Sector, TestResult } from '../model/types'

export interface LibraryRepository {
  saveActivity(activity: Activity, rawBytes: Uint8Array): Promise<void>
  getActivity(id: string): Promise<Activity | null>
  hasActivity(id: string): Promise<boolean>
  /** sorted by startTime, newest first */
  listActivities(): Promise<Activity[]>
  /** cascades raw bytes, sectors, test results, and notes */
  deleteActivity(id: string): Promise<void>
  getRawFile(id: string): Promise<Uint8Array | null>
  updateExclusions(activityId: string, exclusions: Exclusions): Promise<void>
  saveSector(sector: Sector): Promise<void>
  listSectors(activityId: string): Promise<Sector[]>
  deleteSector(id: string): Promise<void>
  saveTestResult(result: TestResult): Promise<void>
  listTestResults(): Promise<TestResult[]>
  deleteTestResult(id: string): Promise<void>
  saveNote(note: Note): Promise<void>
  getNote(activityId: string): Promise<Note | null>
}
```

`src/adapters/fit/hash.ts`:

```ts
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
```

`src/adapters/fit/decode-fit.ts`:

```ts
import { Decoder, Stream } from '@garmin/fitsdk'
import { defaultExclusions, makeSeries } from '../../domain/model/series'
import type { Activity, ChannelKind, Series } from '../../domain/model/types'

export class FitDecodeError extends Error {}

interface FitRecord {
  timestamp?: Date
  heartRate?: number
  speed?: number
  enhancedSpeed?: number
  power?: number
  cadence?: number
  altitude?: number
  enhancedAltitude?: number
  distance?: number
  temperature?: number
  developerFields?: Record<number, unknown>
}

interface FitMessages {
  recordMesgs?: FitRecord[]
  sessionMesgs?: Array<{ startTime?: Date; totalElapsedTime?: number; sport?: string }>
  sportMesgs?: Array<{ sport?: string }>
  fileIdMesgs?: Array<{ garminProduct?: string | number; manufacturer?: string | number }>
  fieldDescriptionMesgs?: Array<{ fieldName?: string; units?: string; key?: number }>
}

export function decodeFitActivity(bytes: Uint8Array, id: string): Activity {
  const decoder = new Decoder(Stream.fromByteArray(bytes))
  if (!decoder.isFIT()) throw new FitDecodeError('not a FIT file')
  if (!decoder.checkIntegrity()) throw new FitDecodeError('FIT file failed integrity check')

  const { messages } = decoder.read() as { messages: FitMessages }
  const records = messages.recordMesgs ?? []
  const session = messages.sessionMesgs?.[0]
  const startTime = session?.startTime ?? records.find((r) => r.timestamp)?.timestamp
  if (!startTime) throw new FitDecodeError('FIT file contains no timestamped records')

  // Developer-field power (e.g. Stryd): descriptions carry the lookup key into
  // record.developerFields — see fixtures-manifest / spike facts.
  const powerKey = messages.fieldDescriptionMesgs?.find(
    (f) => f.fieldName === 'Power' && /watt/i.test(String(f.units ?? '')),
  )?.key
  const devPower = (r: FitRecord): unknown =>
    powerKey === undefined ? undefined : r.developerFields?.[powerKey]

  const extractors: Array<[ChannelKind, (r: FitRecord) => unknown]> = [
    ['heartRate', (r) => r.heartRate],
    ['speed', (r) => r.enhancedSpeed ?? r.speed],
    ['power', (r) => r.power ?? devPower(r)],
    ['cadence', (r) => r.cadence],
    ['altitude', (r) => r.enhancedAltitude ?? r.altitude],
    ['distance', (r) => r.distance],
    ['temperature', (r) => r.temperature],
  ]

  const raw = new Map<ChannelKind, { t: number[]; v: number[] }>(
    extractors.map(([kind]) => [kind, { t: [], v: [] }]),
  )
  let prevT = -Infinity
  let lastT = 0
  for (const rec of records) {
    if (!rec.timestamp) continue
    const t = (rec.timestamp.getTime() - startTime.getTime()) / 1000
    if (t < 0 || t <= prevT) continue
    prevT = t
    lastT = t
    for (const [kind, extract] of extractors) {
      const value = extract(rec)
      if (typeof value === 'number' && Number.isFinite(value)) {
        const target = raw.get(kind)!
        target.t.push(t)
        target.v.push(value)
      }
    }
  }

  const channels: Partial<Record<ChannelKind, Series>> = {}
  for (const [kind, data] of raw) {
    if (data.t.length > 0) channels[kind] = makeSeries(data.t, data.v)
  }
  if (Object.keys(channels).length === 0) {
    throw new FitDecodeError('FIT file contains no usable channel data')
  }

  const durationS = session?.totalElapsedTime ?? lastT
  const fileId = messages.fileIdMesgs?.[0]
  return {
    id,
    startTime,
    durationS,
    sport: session?.sport ?? messages.sportMesgs?.[0]?.sport ?? 'unknown',
    device:
      fileId?.garminProduct != null
        ? String(fileId.garminProduct)
        : fileId?.manufacturer != null
          ? String(fileId.manufacturer)
          : null,
    channels,
    exclusions: defaultExclusions(durationS),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(adapters): ports, SHA-256 hashing, FIT decode adapter with developer-field power"
```

---

### Task 3: Zip-aware ActivityFileParser implementation

**Files:**
- Create: `src/adapters/fit/fit-file-parser.ts`, `src/adapters/fit/fit-file-parser.test.ts`

**Interfaces:**
- Consumes: `ActivityFileParser`, `ParseOutcome` (Task 2 port); `decodeFitActivity`, `FitDecodeError`, `sha256Hex` (Task 2); `unzipSync`, `zipSync` from `fflate`.
- Produces: `class GarminFitFileParser implements ActivityFileParser` — the parser adapter the app container will wire in milestone 3. Activity `id` = SHA-256 of the individual file's bytes (zip entries hash per-entry).

- [ ] **Step 1: Write the failing tests**

`src/adapters/fit/fit-file-parser.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { zipSync } from 'fflate'
import { fixtureBytes } from '../testing/fixtures'
import { sha256Hex } from './hash'
import { GarminFitFileParser } from './fit-file-parser'

const parser = new GarminFitFileParser()

describe('GarminFitFileParser', () => {
  it('parses a single .fit file with content-hash id', async () => {
    const bytes = fixtureBytes('Activity.fit')
    const outcomes = await parser.parse(bytes, 'Activity.fit')
    expect(outcomes).toHaveLength(1)
    const o = outcomes[0]!
    if (!o.ok) throw new Error(o.reason)
    expect(o.filename).toBe('Activity.fit')
    expect(o.activity.id).toBe(await sha256Hex(bytes))
    expect(o.rawBytes).toBe(bytes)
  })

  it('parses every .fit entry of a zip', async () => {
    const outcomes = await parser.parse(fixtureBytes('activities.zip'), 'activities.zip')
    expect(outcomes).toHaveLength(2)
    expect(outcomes.every((o) => o.ok)).toBe(true)
    const names = outcomes.map((o) => o.filename).sort()
    expect(names).toEqual(['Activity.fit', 'WithGearChangeData.fit'])
    const ids = new Set(outcomes.map((o) => (o.ok ? o.activity.id : '')))
    expect(ids.size).toBe(2)
  })

  it('isolates bad entries inside a zip', async () => {
    const zip = zipSync({
      'good.fit': fixtureBytes('Activity.fit'),
      'bad.fit': fixtureBytes('corrupt.fit'),
    })
    const outcomes = await parser.parse(zip, 'mixed.zip')
    expect(outcomes).toHaveLength(2)
    const good = outcomes.find((o) => o.filename === 'good.fit')!
    const bad = outcomes.find((o) => o.filename === 'bad.fit')!
    expect(good.ok).toBe(true)
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.reason).toMatch(/FIT/)
  })

  it('reports a zip with no .fit entries', async () => {
    const zip = zipSync({ 'readme.txt': new TextEncoder().encode('hello') })
    const outcomes = await parser.parse(zip, 'empty.zip')
    expect(outcomes).toEqual([
      { ok: false, filename: 'empty.zip', reason: 'zip contains no .fit files' },
    ])
  })

  it('reports an unreadable zip', async () => {
    const junk = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5])
    const outcomes = await parser.parse(junk, 'broken.zip')
    expect(outcomes).toHaveLength(1)
    expect(outcomes[0]!.ok).toBe(false)
  })

  it('reports a non-FIT single file', async () => {
    const outcomes = await parser.parse(fixtureBytes('not-a-fit.txt'), 'not-a-fit.txt')
    expect(outcomes).toHaveLength(1)
    const o = outcomes[0]!
    expect(o.ok).toBe(false)
    if (!o.ok) expect(o.reason).toMatch(/not a FIT/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./fit-file-parser`.

- [ ] **Step 3: Implement**

`src/adapters/fit/fit-file-parser.ts`:

```ts
import { unzipSync } from 'fflate'
import type { ActivityFileParser, ParseOutcome } from '../../domain/ports/activity-file-parser'
import { decodeFitActivity, FitDecodeError } from './decode-fit'
import { sha256Hex } from './hash'

function isZip(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  )
}

export class GarminFitFileParser implements ActivityFileParser {
  async parse(bytes: Uint8Array, filename: string): Promise<ParseOutcome[]> {
    if (isZip(bytes) || filename.toLowerCase().endsWith('.zip')) {
      return this.parseZip(bytes, filename)
    }
    return [await this.parseSingle(bytes, filename)]
  }

  private async parseZip(bytes: Uint8Array, filename: string): Promise<ParseOutcome[]> {
    let entries: Record<string, Uint8Array>
    try {
      entries = unzipSync(bytes)
    } catch {
      return [{ ok: false, filename, reason: 'could not read zip archive' }]
    }
    const fitEntries = Object.entries(entries).filter(
      ([name]) => name.toLowerCase().endsWith('.fit') && !name.startsWith('__MACOSX'),
    )
    if (fitEntries.length === 0) {
      return [{ ok: false, filename, reason: 'zip contains no .fit files' }]
    }
    return Promise.all(fitEntries.map(([name, data]) => this.parseSingle(data, name)))
  }

  private async parseSingle(bytes: Uint8Array, filename: string): Promise<ParseOutcome> {
    try {
      const id = await sha256Hex(bytes)
      return { ok: true, filename, activity: decodeFitActivity(bytes, id), rawBytes: bytes }
    } catch (e) {
      const reason =
        e instanceof FitDecodeError
          ? e.message
          : `unexpected error: ${e instanceof Error ? e.message : String(e)}`
      return { ok: false, filename, reason }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(adapters): zip-aware FIT file parser implementing the ActivityFileParser port"
```

---

### Task 4: Dexie LibraryRepository

**Files:**
- Create: `src/adapters/storage/dexie-library-repository.ts`, `src/adapters/storage/dexie-library-repository.test.ts`

**Interfaces:**
- Consumes: `LibraryRepository` port (Task 2); domain model types; `dexie`; `fake-indexeddb` named exports `IDBFactory`, `IDBKeyRange` (tests).
- Produces: `class DexieLibraryRepository implements LibraryRepository`, constructor `new DexieLibraryRepository(opts?: { name?: string; indexedDB?: IDBFactory; IDBKeyRange?: typeof IDBKeyRange })` — no opts in the browser, injected fakes in tests. Dexie schema **version 1**: `activities: 'id, startTime'`, `rawFiles: 'id'`, `sectors: 'id, activityId'`, `testResults: 'id, activityId'`, `notes: 'activityId'`. Raw bytes live in their own table so `listActivities()` never hauls file blobs.

- [ ] **Step 1: Write the failing tests**

`src/adapters/storage/dexie-library-repository.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { makeSeries } from '../../domain/model/series'
import type { AetTestResult, Note, Sector } from '../../domain/model/types'
import { syntheticActivity } from '../../domain/testing/synthetic'
import { DexieLibraryRepository } from './dexie-library-repository'

let counter = 0
function freshRepo() {
  counter += 1
  return new DexieLibraryRepository({
    name: `test-db-${counter}`,
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  })
}

function activityWithData(id: string, startTime: Date) {
  const a = syntheticActivity({ durationS: 600, id, startTime })
  a.channels.heartRate = makeSeries([0, 1, 2], [150, 151, 152])
  return a
}

const sector: Sector = {
  id: 's1',
  activityId: 'a1',
  range: { startS: 10, endS: 20 },
  label: 'interval',
  kind: 'sector',
}

const testResult: AetTestResult = {
  kind: 'aet',
  id: 't1',
  activityId: 'a1',
  testDate: new Date('2026-07-01T08:00:00Z'),
  createdAt: new Date('2026-07-01T10:00:00Z'),
  window: { startS: 0, endS: 3600 },
  driftChannel: 'speed',
  decouplingPct: 4.2,
  windowAvgHr: 150.4,
  verdict: 'at-aet',
  aetHr: 150,
}

const note: Note = { activityId: 'a1', text: 'felt great', updatedAt: new Date() }

describe('DexieLibraryRepository', () => {
  it('round-trips an activity preserving typed arrays, dates, and exclusions', async () => {
    const repo = freshRepo()
    const a = activityWithData('a1', new Date('2026-07-01T08:00:00Z'))
    a.exclusions = { warmupEndS: 60, cooldownStartS: 540 }
    await repo.saveActivity(a, new Uint8Array([9, 8, 7]))
    const loaded = await repo.getActivity('a1')
    expect(loaded).not.toBeNull()
    expect(loaded!.channels.heartRate!.v).toBeInstanceOf(Float64Array)
    expect(Array.from(loaded!.channels.heartRate!.v)).toEqual([150, 151, 152])
    expect(loaded!.startTime).toEqual(new Date('2026-07-01T08:00:00Z'))
    expect(loaded!.exclusions).toEqual({ warmupEndS: 60, cooldownStartS: 540 })
  })

  it('hasActivity and missing lookups', async () => {
    const repo = freshRepo()
    await repo.saveActivity(activityWithData('a1', new Date()), new Uint8Array())
    expect(await repo.hasActivity('a1')).toBe(true)
    expect(await repo.hasActivity('nope')).toBe(false)
    expect(await repo.getActivity('nope')).toBeNull()
    expect(await repo.getRawFile('nope')).toBeNull()
  })

  it('lists activities newest first', async () => {
    const repo = freshRepo()
    await repo.saveActivity(activityWithData('old', new Date('2026-06-01T08:00:00Z')), new Uint8Array())
    await repo.saveActivity(activityWithData('new', new Date('2026-07-01T08:00:00Z')), new Uint8Array())
    const list = await repo.listActivities()
    expect(list.map((a) => a.id)).toEqual(['new', 'old'])
  })

  it('round-trips raw file bytes', async () => {
    const repo = freshRepo()
    const bytes = new Uint8Array([1, 2, 3, 255])
    await repo.saveActivity(activityWithData('a1', new Date()), bytes)
    expect(Array.from((await repo.getRawFile('a1'))!)).toEqual([1, 2, 3, 255])
  })

  it('updates exclusions in place and rejects unknown activities', async () => {
    const repo = freshRepo()
    await repo.saveActivity(activityWithData('a1', new Date()), new Uint8Array())
    await repo.updateExclusions('a1', { warmupEndS: 120, cooldownStartS: 500 })
    expect((await repo.getActivity('a1'))!.exclusions).toEqual({
      warmupEndS: 120,
      cooldownStartS: 500,
    })
    await expect(repo.updateExclusions('nope', { warmupEndS: 0, cooldownStartS: 1 })).rejects.toThrow(
      /not found/,
    )
  })

  it('manages sectors per activity', async () => {
    const repo = freshRepo()
    await repo.saveSector(sector)
    await repo.saveSector({ ...sector, id: 's2', activityId: 'other' })
    expect((await repo.listSectors('a1')).map((s) => s.id)).toEqual(['s1'])
    await repo.deleteSector('s1')
    expect(await repo.listSectors('a1')).toEqual([])
  })

  it('manages test results and notes', async () => {
    const repo = freshRepo()
    await repo.saveTestResult(testResult)
    expect(await repo.listTestResults()).toHaveLength(1)
    await repo.saveNote(note)
    await repo.saveNote({ ...note, text: 'updated' })
    expect((await repo.getNote('a1'))!.text).toBe('updated')
    expect(await repo.getNote('nope')).toBeNull()
    await repo.deleteTestResult('t1')
    expect(await repo.listTestResults()).toEqual([])
  })

  it('deleteActivity cascades everything', async () => {
    const repo = freshRepo()
    await repo.saveActivity(activityWithData('a1', new Date()), new Uint8Array([1]))
    await repo.saveSector(sector)
    await repo.saveTestResult(testResult)
    await repo.saveNote(note)
    await repo.deleteActivity('a1')
    expect(await repo.getActivity('a1')).toBeNull()
    expect(await repo.getRawFile('a1')).toBeNull()
    expect(await repo.listSectors('a1')).toEqual([])
    expect(await repo.listTestResults()).toEqual([])
    expect(await repo.getNote('a1')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./dexie-library-repository`.

- [ ] **Step 3: Implement**

`src/adapters/storage/dexie-library-repository.ts`:

```ts
import Dexie, { type Table } from 'dexie'
import type { Activity, Exclusions, Note, Sector, TestResult } from '../../domain/model/types'
import type { LibraryRepository } from '../../domain/ports/library-repository'

interface RawFileRow {
  id: string
  bytes: Uint8Array
}

export interface DexieRepositoryOptions {
  name?: string
  indexedDB?: IDBFactory
  IDBKeyRange?: typeof IDBKeyRange
}

export class DexieLibraryRepository implements LibraryRepository {
  private readonly db: Dexie
  private readonly activities: Table<Activity, string>
  private readonly rawFiles: Table<RawFileRow, string>
  private readonly sectors: Table<Sector, string>
  private readonly testResults: Table<TestResult, string>
  private readonly notes: Table<Note, string>

  constructor(opts: DexieRepositoryOptions = {}) {
    const name = opts.name ?? 'runalyze'
    this.db = opts.indexedDB
      ? new Dexie(name, { indexedDB: opts.indexedDB, IDBKeyRange: opts.IDBKeyRange })
      : new Dexie(name)
    this.db.version(1).stores({
      activities: 'id, startTime',
      rawFiles: 'id',
      sectors: 'id, activityId',
      testResults: 'id, activityId',
      notes: 'activityId',
    })
    this.activities = this.db.table('activities')
    this.rawFiles = this.db.table('rawFiles')
    this.sectors = this.db.table('sectors')
    this.testResults = this.db.table('testResults')
    this.notes = this.db.table('notes')
  }

  async saveActivity(activity: Activity, rawBytes: Uint8Array): Promise<void> {
    await this.db.transaction('rw', [this.activities, this.rawFiles], async () => {
      await this.activities.put(activity)
      await this.rawFiles.put({ id: activity.id, bytes: rawBytes })
    })
  }

  async getActivity(id: string): Promise<Activity | null> {
    return (await this.activities.get(id)) ?? null
  }

  async hasActivity(id: string): Promise<boolean> {
    return (await this.activities.get(id)) !== undefined
  }

  async listActivities(): Promise<Activity[]> {
    const all = await this.activities.toArray()
    return all.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
  }

  async deleteActivity(id: string): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.activities, this.rawFiles, this.sectors, this.testResults, this.notes],
      async () => {
        await this.activities.delete(id)
        await this.rawFiles.delete(id)
        await this.sectors.where('activityId').equals(id).delete()
        await this.testResults.where('activityId').equals(id).delete()
        await this.notes.delete(id)
      },
    )
  }

  async getRawFile(id: string): Promise<Uint8Array | null> {
    return (await this.rawFiles.get(id))?.bytes ?? null
  }

  async updateExclusions(activityId: string, exclusions: Exclusions): Promise<void> {
    const updated = await this.activities.update(activityId, { exclusions })
    if (updated === 0) throw new Error(`activity not found: ${activityId}`)
  }

  async saveSector(sector: Sector): Promise<void> {
    await this.sectors.put(sector)
  }

  async listSectors(activityId: string): Promise<Sector[]> {
    return this.sectors.where('activityId').equals(activityId).toArray()
  }

  async deleteSector(id: string): Promise<void> {
    await this.sectors.delete(id)
  }

  async saveTestResult(result: TestResult): Promise<void> {
    await this.testResults.put(result)
  }

  async listTestResults(): Promise<TestResult[]> {
    return this.testResults.toArray()
  }

  async deleteTestResult(id: string): Promise<void> {
    await this.testResults.delete(id)
  }

  async saveNote(note: Note): Promise<void> {
    await this.notes.put(note)
  }

  async getNote(activityId: string): Promise<Note | null> {
    return (await this.notes.get(activityId)) ?? null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(adapters): Dexie LibraryRepository with cascade delete and injected IndexedDB for tests"
```

---

### Task 5: Real-file integration — parse → store → analyze

**Files:**
- Create: `src/adapters/integration.test.ts`

**Interfaces:**
- Consumes: everything above plus `computeDecoupling`, `evaluateAetTest`, `sectorStats` (milestone 1).
- Produces: proof the stack composes on real data; expected values from the manifest.

- [ ] **Step 1: Write the failing test**

`src/adapters/integration.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { evaluateAetTest } from '../domain/analysis/aet-protocol'
import { computeDecoupling } from '../domain/analysis/decoupling'
import { sectorStats } from '../domain/analysis/sector-stats'
import { GarminFitFileParser } from './fit/fit-file-parser'
import { DexieLibraryRepository } from './storage/dexie-library-repository'
import { fixtureBytes } from './testing/fixtures'

const WINDOW = { startS: 0, endS: 3600 }

describe('integration: parse -> store -> analyze on real files', () => {
  it('runs the full AeT pipeline on the user run (manifest values)', async () => {
    const parser = new GarminFitFileParser()
    const outcomes = await parser.parse(
      fixtureBytes('user-run-2026-07-05.fit'),
      'user-run-2026-07-05.fit',
    )
    expect(outcomes).toHaveLength(1)
    const outcome = outcomes[0]!
    if (!outcome.ok) throw new Error(outcome.reason)

    const repo = new DexieLibraryRepository({
      name: 'integration-user-run',
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    })
    await repo.saveActivity(outcome.activity, outcome.rawBytes)
    const loaded = (await repo.getActivity(outcome.activity.id))!

    const hr = loaded.channels.heartRate!
    const speed = loaded.channels.speed!
    const power = loaded.channels.power!
    expect(hr.t.length).toBe(3602)
    expect(power.v[0]).toBe(221)

    // fixtures-manifest.md: hand-computed 2026-07-05, pre-implementation
    expect(computeDecoupling(speed, hr, WINDOW).decouplingPct).toBeCloseTo(3.5606, 3)
    expect(computeDecoupling(power, hr, WINDOW).decouplingPct).toBeCloseTo(2.4284, 3)

    const evaluation = evaluateAetTest(loaded, WINDOW, 'speed')
    expect(evaluation.verdict).toBe('at-aet')
    expect(evaluation.valid).toBe(true)
    expect(evaluation.windowAvgHr).toBeCloseTo(159.0103, 2)
    expect(evaluation.suggestedAetHr).toBe(159)
  })

  it('parses and analyzes a constant-speed file exactly', async () => {
    const parser = new GarminFitFileParser()
    const [outcome] = await parser.parse(fixtureBytes('Activity.fit'), 'Activity.fit')
    if (!outcome!.ok) throw new Error('expected ok outcome')
    const stats = sectorStats(outcome!.activity, { startS: 0, endS: 3600 })
    expect(stats.speed!.whole.mean).toBe(1)
    expect(stats.speed!.firstHalf.mean).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: the new file FAILS only if implementation gaps exist — if Tasks 2–4 are correct it may pass immediately; TDD value here is the assertion against pre-registered manifest values, not the red phase. If it fails, the failing assertion pinpoints which adapter diverges from the manifest.

- [ ] **Step 3: Run the full gate**

Run: `npm test && npm run lint && npm run build`
Expected: all green.

Run: `grep -rE "from 'react|from 'dexie|@garmin|document\.|window\." src/domain/`
Expected: no output (ports are types-only).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(adapters): real-file integration - parse, persist, and AeT-analyze the user run"
```

---

## Definition of done (milestone 2)

- All suites green (milestone 1's 58 + new adapter/integration tests).
- `npm run lint`, `npm run build` exit 0; `npm run dev` still serves.
- Domain purity grep clean (ports contain types only).
- `tests/fixtures/fixtures-manifest.md` committed with values independently computed before the tests existed.
- The user's real run parses, persists, reloads, and produces decoupling 3.5606 % (Pa:HR) / verdict `at-aet` through the entire stack.
