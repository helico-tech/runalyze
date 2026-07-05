import { useEffect, useRef } from 'react'
import type { LibraryRepository } from '../../../domain/ports/library-repository'
import type { Exclusions, Sector } from '../../../domain/model/types'
import type { WorkspaceStore } from './workspace-store'

/** Persists store sector/exclusion changes to the repo, debounced, via diffing. */
export function useWorkspacePersistence(
  store: WorkspaceStore,
  repo: LibraryRepository,
  activityId: string,
  ready: boolean,
) {
  const prevSectors = useRef<Map<string, Sector>>(new Map())
  const prevExclusions = useRef<Exclusions | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!ready) return
    // seed refs with the initial persisted state (no writes on first pass)
    const s = store.getState()
    prevSectors.current = new Map(s.sectors.map((sec) => [sec.id, sec]))
    prevExclusions.current = s.exclusions

    const flush = () => {
      const { sectors, exclusions } = store.getState()
      const now = new Map(sectors.map((sec) => [sec.id, sec]))
      for (const sec of sectors) {
        const prev = prevSectors.current.get(sec.id)
        if (!prev || JSON.stringify(prev) !== JSON.stringify(sec)) void repo.saveSector(sec)
      }
      for (const id of prevSectors.current.keys()) {
        if (!now.has(id)) void repo.deleteSector(id)
      }
      prevSectors.current = now
      if (
        prevExclusions.current &&
        (prevExclusions.current.warmupEndS !== exclusions.warmupEndS ||
          prevExclusions.current.cooldownStartS !== exclusions.cooldownStartS)
      ) {
        void repo.updateExclusions(activityId, exclusions)
      }
      prevExclusions.current = exclusions
    }

    const unsub = store.subscribe(() => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, 500)
    })
    return () => {
      if (timer.current) clearTimeout(timer.current)
      unsub()
    }
  }, [store, repo, activityId, ready])
}
