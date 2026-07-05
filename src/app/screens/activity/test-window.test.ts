import { describe, expect, it } from 'vitest'
import { syntheticActivity, syntheticSeries } from '../../../domain/testing/synthetic'
import { suggestTestWindow, testWindowSector, TEST_WINDOW_ID } from './test-window'

describe('test-window helpers', () => {
  it('suggests an AeT window sized to the AeT protocol', () => {
    const a = syntheticActivity({
      durationS: 5400,
      channels: { heartRate: syntheticSeries({ durationS: 5400, value: () => 150 }) },
    })
    const w = suggestTestWindow(a, 'aet')
    expect(w).not.toBeNull()
    expect(w!.endS - w!.startS).toBe(3600)
  })

  it('suggests a shorter AnT window', () => {
    const a = syntheticActivity({
      durationS: 2400,
      channels: { heartRate: syntheticSeries({ durationS: 2400, value: () => 150 }) },
    })
    const w = suggestTestWindow(a, 'ant')
    expect(w!.endS - w!.startS).toBe(1800)
  })

  it('returns null when the activity is too short or lacks HR', () => {
    const noHr = syntheticActivity({ durationS: 5400 })
    expect(suggestTestWindow(noHr, 'aet')).toBeNull()
    const short = syntheticActivity({
      durationS: 600,
      channels: { heartRate: syntheticSeries({ durationS: 600, value: () => 150 }) },
    })
    expect(suggestTestWindow(short, 'aet')).toBeNull()
  })

  it('builds a test-window sector with the reserved id', () => {
    const s = testWindowSector('act1', { startS: 300, endS: 3900 })
    expect(s.id).toBe(TEST_WINDOW_ID)
    expect(s.kind).toBe('test-window')
    expect(s.activityId).toBe('act1')
    expect(s.range).toEqual({ startS: 300, endS: 3900 })
  })
})
