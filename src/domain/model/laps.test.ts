import { describe, expect, it } from 'vitest'
import { syntheticActivity } from '../testing/synthetic'
import { manualLaps } from './laps'
import type { Lap } from './types'

const laps: Lap[] = [
  { index: 0, range: { startS: 0, endS: 600 }, trigger: 'manual' },
  { index: 1, range: { startS: 600, endS: 1200 }, trigger: 'auto' },
  { index: 2, range: { startS: 1200, endS: 1300 }, trigger: 'session-end' },
]

describe('manualLaps', () => {
  it('keeps only button-press laps', () => {
    const a = syntheticActivity({ durationS: 1300, laps })
    expect(manualLaps(a).map((l) => l.index)).toEqual([0])
  })
  it('tolerates an activity with no laps field', () => {
    const a = syntheticActivity({ durationS: 60 })
    expect(manualLaps(a)).toEqual([])
  })
})
