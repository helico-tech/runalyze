import { GarminFitFileParser } from '../adapters/fit/fit-file-parser'
import { DexieLibraryRepository } from '../adapters/storage/dexie-library-repository'
import { InMemoryLibraryRepository } from '../adapters/storage/in-memory-library-repository'
import { FakeImageRenderer } from '../adapters/export/fake-image-renderer'
import { HtmlImageRenderer } from '../adapters/export/html-image-renderer'
import type { ActivityFileParser } from '../domain/ports/activity-file-parser'
import type { ImageRenderer } from '../domain/ports/image-renderer'
import type { LibraryRepository } from '../domain/ports/library-repository'

export interface Container {
  parser: ActivityFileParser
  repo: LibraryRepository
  renderer: ImageRenderer
  persistent: boolean
}

export async function createContainer(): Promise<Container> {
  const parser = new GarminFitFileParser()
  const renderer: ImageRenderer =
    typeof document === 'undefined' ? new FakeImageRenderer() : new HtmlImageRenderer()
  try {
    const repo = new DexieLibraryRepository()
    await repo.listActivities() // probe: throws where IndexedDB is unavailable
    return { parser, repo, renderer, persistent: true }
  } catch {
    return { parser, repo: new InMemoryLibraryRepository(), renderer, persistent: false }
  }
}
