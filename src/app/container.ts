import { GarminFitFileParser } from '../adapters/fit/fit-file-parser'
import { DexieLibraryRepository } from '../adapters/storage/dexie-library-repository'
import { InMemoryLibraryRepository } from '../adapters/storage/in-memory-library-repository'
import type { ActivityFileParser } from '../domain/ports/activity-file-parser'
import type { LibraryRepository } from '../domain/ports/library-repository'

export interface Container {
  parser: ActivityFileParser
  repo: LibraryRepository
  persistent: boolean
}

export async function createContainer(): Promise<Container> {
  const parser = new GarminFitFileParser()
  try {
    const repo = new DexieLibraryRepository()
    await repo.listActivities() // probe: throws where IndexedDB is unavailable
    return { parser, repo, persistent: true }
  } catch {
    return { parser, repo: new InMemoryLibraryRepository(), persistent: false }
  }
}
