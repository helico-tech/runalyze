import { describe, expect, it } from 'vitest'
import { makeSeries } from '../model/series'
import { syntheticActivity } from '../testing/synthetic'
import type { AetTestResult, AntTestResult } from '../model/types'
import { computeZones, resolveThresholds } from './zones'

const aetTest: AetTestResult = {
  kind: 'aet', id: 't-aet', activityId: 'run1', testDate: new Date('2026-07-01T08:00:00Z'),
  createdAt: new Date('2026-07-01T10:00:00Z'), window: { startS: 0, endS: 3600 },
  pace: null, power: null, windowAvgHr: 150, aetHr: 150,
}
const antTest: AntTestResult = {
  kind: 'ant', id: 't-ant', activityId: 'run1', testDate: new Date('2026-07-01T08:00:00Z'),
  createdAt: new Date('2026-07-01T10:00:00Z'), window: { startS: 0, endS: 3600 },
  antHr: 172, windowAvgHr: 170, windowAvgSpeed: null, windowAvgPower: null,
}
// A later AeT test on a different run.
const aetTest2: AetTestResult = {
  ...aetTest, id: 't-aet2', activityId: 'run2', testDate: new Date('2026-07-15T08:00:00Z'), aetHr: 158,
}

describe('resolveThresholds', () => {
  it('uses the global value when no test exists at all', () => {
    const g = { aetHr: 145, antHr: 168, updatedAt: new Date('2026-07-06T00:00:00Z') }
    expect(resolveThresholds('run1', g, [])).toEqual({ aetHr: 145, antHr: 168 })
  })
  it("a saved test on the run overrides the global", () => {
    const g = { aetHr: 145, antHr: 168, updatedAt: new Date('2026-07-06T00:00:00Z') }
    expect(resolveThresholds('run1', g, [aetTest, antTest])).toEqual({ aetHr: 150, antHr: 172 })
  })
  it('a test on another run carries over as a fallback, above the manual global', () => {
    const g = { aetHr: 145, antHr: 168, updatedAt: new Date('2026-07-06T00:00:00Z') }
    // run1's AeT test drives 'other'; AnT has no test anywhere so falls to the global.
    expect(resolveThresholds('other', g, [aetTest])).toEqual({ aetHr: 150, antHr: 168 })
  })
  it('the most recent test wins when the run has none of its own', () => {
    // aetTest2 (2026-07-15) is newer than aetTest (2026-07-01); order must not matter.
    expect(resolveThresholds('other', null, [aetTest, aetTest2])).toEqual({ aetHr: 158, antHr: null })
    expect(resolveThresholds('other', null, [aetTest2, aetTest])).toEqual({ aetHr: 158, antHr: null })
  })
  it("the run's own test beats a newer test on another run", () => {
    // run1 keeps its own 150 even though run2's test is more recent.
    expect(resolveThresholds('run1', null, [aetTest, aetTest2])).toEqual({ aetHr: 150, antHr: null })
  })
  it('null global with no test yields nulls', () => {
    expect(resolveThresholds('run1', null, [])).toEqual({ aetHr: null, antHr: null })
  })
  it('a test with null aetHr is ignored in favour of a valid one, else the global', () => {
    const nullAetTest: AetTestResult = { ...aetTest, aetHr: null }
    const g = { aetHr: 145, antHr: 168, updatedAt: new Date('2026-07-06T00:00:00Z') }
    expect(resolveThresholds('run1', g, [nullAetTest])).toEqual({ aetHr: 145, antHr: 168 })
    // a valid test elsewhere still wins over the global despite the null one.
    expect(resolveThresholds('run1', g, [nullAetTest, aetTest2])).toEqual({ aetHr: 158, antHr: 168 })
  })
})

describe('computeZones', () => {
  const hr = (val: (s: number) => number) =>
    syntheticActivity({ durationS: 300, channels: { heartRate: makeSeries(
      Array.from({ length: 300 }, (_, i) => i), Array.from({ length: 300 }, (_, i) => val(i)),
    ) } })

  it('errors without HR', () => {
    const a = syntheticActivity({ durationS: 300 })
    expect(computeZones(a, { aetHr: 140, antHr: 160 })).toEqual({ ok: false, reason: 'no-hr' })
  })
  it('errors without thresholds', () => {
    expect(computeZones(hr(() => 150), { aetHr: null, antHr: 160 })).toEqual({ ok: false, reason: 'no-thresholds' })
  })
  it('errors when aet >= ant', () => {
    expect(computeZones(hr(() => 150), { aetHr: 160, antHr: 150 })).toEqual({ ok: false, reason: 'invalid-order' })
  })
  it('partitions time across three zones', () => {
    // 0..99 → 130 (below), 100..199 → 155 (mid), 200..299 → 175 (above); 100 samples × 1 s each.
    const a = hr((s) => (s < 100 ? 130 : s < 200 ? 155 : 175))
    const r = computeZones(a, { aetHr: 140, antHr: 170 })
    if (!r.ok) throw new Error('expected ok')
    expect(r.belowAetS).toBeCloseTo(100, 0)
    expect(r.aetToAntS).toBeCloseTo(100, 0)
    expect(r.aboveAntS).toBeCloseTo(100, 0)
    expect(r.totalS).toBeCloseTo(300, 0)
  })
})
