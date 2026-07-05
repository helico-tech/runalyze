import { describe, expect, it } from 'vitest'
import type { Sector } from '../../../domain/model/types'
import { syntheticActivity, syntheticSeries } from '../../../domain/testing/synthetic'
import { createWorkspaceStore } from './workspace-store'

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
    expect(s.driftChannel).toBe('speed')
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

  it('sets drift channel', () => {
    const store = createWorkspaceStore()
    store.getState().init(activity(), [])
    store.getState().setDriftChannel('power')
    expect(store.getState().driftChannel).toBe('power')
  })
})
