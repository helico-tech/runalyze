import { describe, expect, it } from 'vitest'
import { syntheticActivity, syntheticSeries } from '../testing/synthetic'
import { buildAntResult, evaluateAntTest } from './ant-protocol'

// 10 min warmup-ish effort at 155, then 20 min at 168; steady 3.4 m/s
function ttActivity() {
  return syntheticActivity({
    durationS: 1800,
    channels: {
      heartRate: syntheticSeries({ durationS: 1800, value: (t) => (t < 600 ? 155 : 168) }),
      speed: syntheticSeries({ durationS: 1800, value: () => 3.4 }),
    },
  })
}
const WINDOW = { startS: 0, endS: 1800 }

describe('evaluateAntTest', () => {
  it('averages HR over the final 20 minutes', () => {
    const e = evaluateAntTest(ttActivity(), WINDOW)
    expect(e.antHr).toBe(168)
    expect(e.windowAvgHr).toBeCloseTo((600 * 155 + 1200 * 168) / 1800, 6)
    expect(e.windowAvgSpeed).toBeCloseTo(3.4, 9)
    expect(e.windowAvgPower).toBeNull()
    expect(e.valid).toBe(true)
    expect(e.warnings).toEqual([])
  })

  it('clamps the averaging span to the window start when too short', () => {
    const e = evaluateAntTest(ttActivity(), { startS: 900, endS: 1800 })
    expect(e.antHr).toBe(168) // [900, 1800) only, not [600, 1800)
    expect(e.warnings).toContain('window-too-short')
    expect(e.valid).toBe(false)
  })

  it('throws on missing heart rate', () => {
    const a = syntheticActivity({ durationS: 1800 })
    expect(() => evaluateAntTest(a, WINDOW)).toThrow(/missing channel: heartRate/)
  })
})

describe('buildAntResult', () => {
  it('builds a rounded result from a valid evaluation', () => {
    const a = ttActivity()
    const e = evaluateAntTest(a, WINDOW)
    const r = buildAntResult({
      id: 'r1',
      activity: a,
      window: WINDOW,
      evaluation: e,
      createdAt: new Date('2026-07-05T10:00:00Z'),
    })
    expect(r.kind).toBe('ant')
    expect(r.antHr).toBe(168)
    expect(r.windowAvgSpeed).toBeCloseTo(3.4, 9)
    expect(r.windowAvgPower).toBeNull()
    expect(r.testDate).toEqual(a.startTime)
  })

  it('refuses invalid evaluations', () => {
    const a = ttActivity()
    const e = evaluateAntTest(a, { startS: 900, endS: 1800 })
    expect(() =>
      buildAntResult({
        id: 'r2',
        activity: a,
        window: { startS: 900, endS: 1800 },
        evaluation: e,
        createdAt: new Date(),
      }),
    ).toThrow(/invalid/)
  })
})
