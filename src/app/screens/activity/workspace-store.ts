import { createStore, useStore as useZustandStore } from 'zustand'
import type {
  Activity,
  DriftChannel,
  Exclusions,
  Sector,
  TimeRange,
} from '../../../domain/model/types'
import { channelsPresent, type DisplayChannel } from '../../channels'
import { TEST_WINDOW_ID, testWindowSector, type TestKind } from './test-window'

export interface WorkspaceState {
  visible: Set<DisplayChannel>
  driftChannel: DriftChannel
  sectors: Sector[]
  exclusions: Exclusions
  selectedSectorId: string | null
  activeTest: TestKind | null
  hoverT: number | null
  init(activity: Activity, sectors: Sector[]): void
  toggleChannel(c: DisplayChannel): void
  setDriftChannel(c: DriftChannel): void
  setSectors(sectors: Sector[]): void
  setExclusions(ex: Exclusions): void
  select(id: string | null): void
  removeSector(id: string): void
  startTest(kind: TestKind, range: TimeRange, activityId: string): void
  cancelTest(): void
  setHoverT(t: number | null): void
}

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>

export function createWorkspaceStore() {
  return createStore<WorkspaceState>((set) => ({
    visible: new Set(),
    driftChannel: 'speed',
    sectors: [],
    exclusions: { warmupEndS: 0, cooldownStartS: 0 },
    selectedSectorId: null,
    activeTest: null,
    hoverT: null,
    init: (activity, sectors) =>
      set({
        visible: new Set(channelsPresent(activity).map((c) => c.key)),
        driftChannel: 'speed',
        sectors,
        exclusions: activity.exclusions,
        selectedSectorId: null,
        activeTest: null,
        hoverT: null,
      }),
    toggleChannel: (c) =>
      set((s) => {
        const visible = new Set(s.visible)
        if (visible.has(c)) visible.delete(c)
        else visible.add(c)
        return { visible }
      }),
    setDriftChannel: (driftChannel) => set({ driftChannel }),
    setSectors: (sectors) => set({ sectors }),
    setExclusions: (exclusions) => set({ exclusions }),
    select: (selectedSectorId) => set({ selectedSectorId }),
    removeSector: (id) =>
      set((s) => ({
        sectors: s.sectors.filter((sec) => sec.id !== id),
        selectedSectorId: s.selectedSectorId === id ? null : s.selectedSectorId,
      })),
    startTest: (kind, range, activityId) =>
      set((s) => ({
        activeTest: kind,
        sectors: [
          ...s.sectors.filter((x) => x.id !== TEST_WINDOW_ID),
          testWindowSector(activityId, range),
        ],
        selectedSectorId: TEST_WINDOW_ID,
      })),
    cancelTest: () =>
      set((s) => ({
        activeTest: null,
        sectors: s.sectors.filter((x) => x.id !== TEST_WINDOW_ID),
        selectedSectorId: s.selectedSectorId === TEST_WINDOW_ID ? null : s.selectedSectorId,
      })),
    setHoverT: (hoverT) => set({ hoverT }),
  }))
}

/** Bind a component to a slice of a per-activity store. */
export function useWorkspace<T>(store: WorkspaceStore, selector: (s: WorkspaceState) => T): T {
  return useZustandStore(store, selector)
}
