import { describe, expect, it } from 'vitest'
import { InMemoryLibraryRepository } from '../adapters/storage/in-memory-library-repository'
import { createContainer } from './container'

describe('createContainer', () => {
  it('falls back to in-memory storage when IndexedDB is unavailable', async () => {
    // node test env has no indexedDB
    const c = await createContainer()
    expect(c.persistent).toBe(false)
    expect(c.repo).toBeInstanceOf(InMemoryLibraryRepository)
    await c.repo.saveActivity(
      {
        id: 'x',
        startTime: new Date(),
        durationS: 1,
        sport: 'running',
        device: null,
        channels: {},
        exclusions: { warmupEndS: 0, cooldownStartS: 1 },
      },
      new Uint8Array(),
    )
    expect(await c.repo.hasActivity('x')).toBe(true)
  })
})
