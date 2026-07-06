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

describe('resolveThresholds', () => {
  it('uses the global value when no test on the run', () => {
    const g = { aetHr: 145, antHr: 168, updatedAt: new Date('2026-07-06T00:00:00Z') }
    expect(resolveThresholds('run1', g, [])).toEqual({ aetHr: 145, antHr: 168 })
  })
  it("a saved test on the run overrides the global", () => {
    const g = { aetHr: 145, antHr: 168, updatedAt: new Date('2026-07-06T00:00:00Z') }
    expect(resolveThresholds('run1', g, [aetTest, antTest])).toEqual({ aetHr: 150, antHr: 172 })
  })
  it('a test on a different run does not override', () => {
    const g = { aetHr: 145, antHr: 168, updatedAt: new Date('2026-07-06T00:00:00Z') }
    expect(resolveThresholds('other', g, [aetTest])).toEqual({ aetHr: 145, antHr: 168 })
  })
  it('null global with no test yields nulls', () => {
    expect(resolveThresholds('run1', null, [])).toEqual({ aetHr: null, antHr: null })
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
