import { describe, expect, it } from 'vitest'
import { syntheticActivity, syntheticSeries } from '../testing/synthetic'
import { AET_MIN_WINDOW_S } from './protocol-constants'
import { aetVerdict, buildAetResult, evaluateAetTest } from './aet-protocol'

function testActivity(opts?: { warmupEndS?: number }) {
  return syntheticActivity({
    durationS: 5400,
    channels: {
      speed: syntheticSeries({ durationS: 5400, value: () => 3 }),
      heartRate: syntheticSeries({
        durationS: 5400,
        // ratio drops exactly 5% across the halves of [600, 4200)
        value: (t) => (t < 2400 ? 150 : 150 / 0.95),
      }),
    },
    exclusions: { warmupEndS: opts?.warmupEndS ?? 0, cooldownStartS: 5400 },
  })
}
const WINDOW = { startS: 600, endS: 4200 }

describe('aetVerdict bands', () => {
  const cases: Array<[number, string]> = [
    [5.01, 'above-aet'],
    [5.0, 'at-aet'],
    [3.5, 'at-aet'],
    [3.49, 'below-aet'],
    [-2.0, 'below-aet'],
  ]
  it.each(cases)('%f -> %s', (d, expected) => {
    expect(aetVerdict(d)).toBe(expected)
  })
})

describe('evaluateAetTest', () => {
  it('evaluates a valid at-aet test with suggested AeT HR', () => {
    const e = evaluateAetTest(testActivity(), WINDOW, 'speed')
    expect(e.decoupling.decouplingPct).toBeCloseTo(5.0, 6)
    expect(e.verdict).toBe('at-aet')
    expect(e.valid).toBe(true)
    expect(e.warnings).toEqual([])
    // windowAvgHr: 150 for 1800s, 150/0.95 for 1800s -> 153.947...
    expect(e.windowAvgHr).toBeCloseTo((150 + 150 / 0.95) / 2, 6)
    expect(e.suggestedAetHr).toBe(154)
  })

  it('flags short windows and refuses validity', () => {
    const e = evaluateAetTest(
      testActivity(),
      { startS: 600, endS: 600 + AET_MIN_WINDOW_S - 60 },
      'speed',
    )
    expect(e.warnings).toContain('window-too-short')
    expect(e.valid).toBe(false)
  })

  it('flags exclusion overlap and refuses validity', () => {
    const e = evaluateAetTest(testActivity({ warmupEndS: 900 }), WINDOW, 'speed')
    expect(e.warnings).toContain('overlaps-exclusion')
    expect(e.valid).toBe(false)
  })

  it('warns about gaps but stays valid', () => {
    const a = testActivity()
    // knock out 150s of HR inside the window
    const hr = syntheticSeries({
      durationS: 5400,
      value: (t) => (t >= 1000 && t < 1150 ? NaN : t < 2400 ? 150 : 150 / 0.95),
    })
    a.channels.heartRate = hr
    const e = evaluateAetTest(a, WINDOW, 'speed')
    expect(e.warnings).toContain('gaps-in-window')
    expect(e.valid).toBe(true)
  })

  it('throws on a missing drift channel', () => {
    const a = testActivity()
    delete a.channels.power
    expect(() => evaluateAetTest(a, WINDOW, 'power')).toThrow(/missing channel: power/)
  })
})

describe('buildAetResult', () => {
  const createdAt = new Date('2026-07-05T10:00:00Z')

  it('builds a result carrying the AeT HR for at-aet', () => {
    const a = testActivity()
    const e = evaluateAetTest(a, WINDOW, 'speed')
    const r = buildAetResult({
      id: 'r1',
      activity: a,
      window: WINDOW,
      driftChannel: 'speed',
      evaluation: e,
      createdAt,
    })
    expect(r.kind).toBe('aet')
    expect(r.aetHr).toBe(154)
    expect(r.testDate).toEqual(a.startTime)
    expect(r.verdict).toBe('at-aet')
  })

  it('leaves aetHr null for below-aet unless explicitly accepted', () => {
    const a = testActivity()
    a.channels.heartRate = syntheticSeries({ durationS: 5400, value: () => 150 }) // 0% decoupling
    const e = evaluateAetTest(a, WINDOW, 'speed')
    expect(e.verdict).toBe('below-aet')
    const rejected = buildAetResult({
      id: 'r2',
      activity: a,
      window: WINDOW,
      driftChannel: 'speed',
      evaluation: e,
      createdAt,
    })
    expect(rejected.aetHr).toBeNull()
    const accepted = buildAetResult({
      id: 'r3',
      activity: a,
      window: WINDOW,
      driftChannel: 'speed',
      evaluation: e,
      createdAt,
      acceptAetHr: true,
    })
    expect(accepted.aetHr).toBe(150)
  })

  it('refuses to build from an invalid evaluation', () => {
    const a = testActivity()
    const e = evaluateAetTest(a, { startS: 600, endS: 1800 }, 'speed')
    expect(() =>
      buildAetResult({
        id: 'r4',
        activity: a,
        window: { startS: 600, endS: 1800 },
        driftChannel: 'speed',
        evaluation: e,
        createdAt,
      }),
    ).toThrow(/invalid/)
  })
})
