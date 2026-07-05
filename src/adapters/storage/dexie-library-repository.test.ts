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
    await repo.saveActivity(
      activityWithData('old', new Date('2026-06-01T08:00:00Z')),
      new Uint8Array(),
    )
    await repo.saveActivity(
      activityWithData('new', new Date('2026-07-01T08:00:00Z')),
      new Uint8Array(),
    )
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
    await expect(
      repo.updateExclusions('nope', { warmupEndS: 0, cooldownStartS: 1 }),
    ).rejects.toThrow(/not found/)
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
