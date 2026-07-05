import { describe, expect, it } from 'vitest'
import type { Sector } from '../../../domain/model/types'
import { syntheticActivity, syntheticSeries } from '../../../domain/testing/synthetic'
import { createWorkspaceStore } from './workspace-store'
import { TEST_WINDOW_ID } from './test-window'

function activity() {
  return syntheticActivity({
    durationS: 3600,
    channels: {
      heartRate: syntheticSeries({ durationS: 3600, value: () => 150 }),
      speed: syntheticSeries({ durationS: 3600, value: () => 3 }),
      power: syntheticSeries({ durationS: 3600, value: () => 200 }),
    },
    exclusions: { warmupEndS: 120, cooldownStartS: 3600 },
  })
}
const sector: Sector = {
  id: 's1',
  activityId: 'test-activity',
  range: { startS: 600, endS: 1200 },
  label: '',
  kind: 'sector',
}

describe('workspace store', () => {
  it('initializes visible channels, drift default, exclusions from the activity', () => {
    const store = createWorkspaceStore()
    store.getState().init(activity(), [sector])
    const s = store.getState()
    expect([...s.visible]).toContain('heartRate')
    expect([...s.visible]).toContain('pace')
    expect(s.exclusions).toEqual({ warmupEndS: 120, cooldownStartS: 3600 })
    expect(s.sectors).toHaveLength(1)
  })

  it('toggles channel visibility', () => {
    const store = createWorkspaceStore()
    store.getState().init(activity(), [])
    store.getState().toggleChannel('power')
    expect(store.getState().visible.has('power')).toBe(false)
    store.getState().toggleChannel('power')
    expect(store.getState().visible.has('power')).toBe(true)
  })

  it('selects and removes sectors', () => {
    const store = createWorkspaceStore()
    store.getState().init(activity(), [sector])
    store.getState().select('s1')
    expect(store.getState().selectedSectorId).toBe('s1')
    store.getState().removeSector('s1')
    expect(store.getState().sectors).toEqual([])
    expect(store.getState().selectedSectorId).toBeNull()
  })

})

describe('workspace store test mode', () => {
  it('starts and cancels a test, managing the test-window sector', () => {
    const store = createWorkspaceStore()
    store.getState().init(activity(), [sector])
    store.getState().startTest('aet', { startS: 300, endS: 3900 }, 'test-activity')
    const s = store.getState()
    expect(s.activeTest).toBe('aet')
    expect(s.sectors.find((x) => x.id === TEST_WINDOW_ID)?.kind).toBe('test-window')
    expect(s.selectedSectorId).toBe(TEST_WINDOW_ID)
    expect(s.sectors.some((x) => x.id === 's1')).toBe(true)

    store.getState().cancelTest()
    expect(store.getState().activeTest).toBeNull()
    expect(store.getState().sectors.some((x) => x.id === TEST_WINDOW_ID)).toBe(false)
    expect(store.getState().sectors.some((x) => x.id === 's1')).toBe(true)
  })

  it('replaces an existing test window when starting another test', () => {
    const store = createWorkspaceStore()
    store.getState().init(activity(), [])
    store.getState().startTest('aet', { startS: 0, endS: 3600 }, 'test-activity')
    store.getState().startTest('ant', { startS: 1800, endS: 3600 }, 'test-activity')
    const windows = store.getState().sectors.filter((x) => x.id === TEST_WINDOW_ID)
    expect(windows).toHaveLength(1)
    expect(store.getState().activeTest).toBe('ant')
  })

  it('sets and clears the hover time without touching sectors', () => {
    const store = createWorkspaceStore()
    store.getState().init(activity(), [sector])
    const sectorsRef = store.getState().sectors
    store.getState().setHoverT(42)
    expect(store.getState().hoverT).toBe(42)
    expect(store.getState().sectors).toBe(sectorsRef)
    store.getState().setHoverT(null)
    expect(store.getState().hoverT).toBeNull()
  })
})
