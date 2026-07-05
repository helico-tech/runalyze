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

  it('converts save failures into per-file errors instead of aborting the batch', async () => {
    const repo = new InMemoryLibraryRepository()
    repo.saveActivity = async () => {
      throw new Error('quota exceeded')
    }
    const results = await importFiles(
      [{ name: 'Activity.fit', bytes: fixtureBytes('Activity.fit') }],
      parser,
      repo,
    )
    expect(results).toHaveLength(1)
    expect(results[0]!.status).toBe('error')
    if (results[0]!.status === 'error') {
      expect(results[0]!.reason).toMatch(/could not save: quota exceeded/)
    }
  })
})
