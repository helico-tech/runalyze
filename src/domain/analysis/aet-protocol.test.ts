import { describe, expect, it } from 'vitest'
import { syntheticActivity, syntheticSeries } from '../testing/synthetic'
import { AET_MIN_WINDOW_S } from './protocol-constants'
import { aetVerdict, buildAetResult, evaluateAetTest } from './aet-protocol'

function testActivity(opts?: { warmupEndS?: number; withPower?: boolean }) {
  const channels = {
    speed: syntheticSeries({ durationS: 5400, value: () => 3 }),
    heartRate: syntheticSeries({
      durationS: 5400,
      // ratio drops exactly 5% across the halves of [600, 4200)
      value: (t) => (t < 2400 ? 150 : 150 / 0.95),
    }),
    ...(opts?.withPower
      ? { power: syntheticSeries({ durationS: 5400, value: () => 200 }) }
      : {}),
  }
  return syntheticActivity({
    durationS: 5400,
    channels,
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
  it('computes the pace channel and leaves power null when absent', () => {
    const e = evaluateAetTest(testActivity(), WINDOW)
    expect(e.pace!.decoupling.decouplingPct).toBeCloseTo(5.0, 6)
    expect(e.pace!.verdict).toBe('at-aet')
    expect(e.power).toBeNull()
    expect(e.atAet).toBe(true)
    expect(e.valid).toBe(true)
    expect(e.warnings).toEqual([])
    expect(e.windowAvgHr).toBeCloseTo((150 + 150 / 0.95) / 2, 6)
    expect(e.suggestedAetHr).toBe(154)
  })

  it('computes both channels when power is present', () => {
    // constant power / rising HR -> ratio drops 5% too, so power is also at-aet
    const e = evaluateAetTest(testActivity({ withPower: true }), WINDOW)
    expect(e.pace!.verdict).toBe('at-aet')
    expect(e.power!.decoupling.decouplingPct).toBeCloseTo(5.0, 6)
    expect(e.power!.verdict).toBe('at-aet')
  })

  it('flags short windows and refuses validity', () => {
    const e = evaluateAetTest(testActivity(), { startS: 600, endS: 600 + AET_MIN_WINDOW_S - 60 })
    expect(e.warnings).toContain('window-too-short')
    expect(e.valid).toBe(false)
  })

  it('flags exclusion overlap and refuses validity', () => {
    const e = evaluateAetTest(testActivity({ warmupEndS: 900 }), WINDOW)
    expect(e.warnings).toContain('overlaps-exclusion')
    expect(e.valid).toBe(false)
  })

  it('warns about gaps but stays valid', () => {
    const a = testActivity()
    a.channels.heartRate = syntheticSeries({
      durationS: 5400,
      value: (t) => (t >= 1000 && t < 1150 ? NaN : t < 2400 ? 150 : 150 / 0.95),
    })
    const e = evaluateAetTest(a, WINDOW)
    expect(e.warnings).toContain('gaps-in-window')
    expect(e.valid).toBe(true)
  })

  it('throws when heart rate is missing', () => {
    const a = testActivity()
    delete a.channels.heartRate
    expect(() => evaluateAetTest(a, WINDOW)).toThrow(/missing channel: heartRate/)
  })

  it('throws when neither drift channel is present', () => {
    const a = testActivity()
    delete a.channels.speed
    expect(() => evaluateAetTest(a, WINDOW)).toThrow(/no drift channel/)
  })
})

describe('buildAetResult', () => {
  const createdAt = new Date('2026-07-05T10:00:00Z')

  it('builds a result carrying both channels and the AeT HR', () => {
    const a = testActivity({ withPower: true })
    const e = evaluateAetTest(a, WINDOW)
    const r = buildAetResult({ id: 'r1', activity: a, window: WINDOW, evaluation: e, createdAt })
    expect(r.kind).toBe('aet')
    expect(r.pace!.verdict).toBe('at-aet')
    expect(r.power!.verdict).toBe('at-aet')
    expect(r.aetHr).toBe(154)
    expect(r.testDate).toEqual(a.startTime)
  })

  it('leaves aetHr null when neither channel is at-aet unless accepted', () => {
    const a = testActivity()
    a.channels.heartRate = syntheticSeries({ durationS: 5400, value: () => 150 }) // 0% decoupling
    const e = evaluateAetTest(a, WINDOW)
    expect(e.pace!.verdict).toBe('below-aet')
    expect(e.atAet).toBe(false)
    const rejected = buildAetResult({ id: 'r2', activity: a, window: WINDOW, evaluation: e, createdAt })
    expect(rejected.aetHr).toBeNull()
    const accepted = buildAetResult({
      id: 'r3',
      activity: a,
      window: WINDOW,
      evaluation: e,
      createdAt,
      acceptAetHr: true,
    })
    expect(accepted.aetHr).toBe(150)
  })

  it('refuses to build from an invalid evaluation', () => {
    const a = testActivity()
    const e = evaluateAetTest(a, { startS: 600, endS: 1800 })
    expect(() =>
      buildAetResult({ id: 'r4', activity: a, window: { startS: 600, endS: 1800 }, evaluation: e, createdAt }),
    ).toThrow(/invalid/)
  })
})
