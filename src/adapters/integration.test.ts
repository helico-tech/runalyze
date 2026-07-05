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
