import { describe, expect, it } from 'vitest'
import { uncoveredS } from '../../domain/analysis/stats'
import type { Series } from '../../domain/model/types'
import { fixtureBytes } from '../testing/fixtures'
import { decodeFitActivity, FitDecodeError } from './decode-fit'

const plainMean = (s: Series) => Array.from(s.v).reduce((a, b) => a + b, 0) / s.v.length

describe('decodeFitActivity', () => {
  it('normalizes Activity.fit per the manifest', () => {
    const a = decodeFitActivity(fixtureBytes('Activity.fit'), 'id-1')
    expect(a.id).toBe('id-1')
    expect(a.startTime.toISOString()).toBe('2021-07-20T21:11:20.000Z')
    expect(a.durationS).toBe(3601)
    expect(a.sport).toBe('standUpPaddleboarding')
    expect(a.device).toBe('development')
    expect(a.exclusions).toEqual({ warmupEndS: 0, cooldownStartS: 3601 })
    const hr = a.channels.heartRate!
    expect(hr.t.length).toBe(3601)
    expect(plainMean(hr)).toBeCloseTo(126.5096, 3)
    expect(a.channels.power!.t.length).toBe(3601)
    expect(plainMean(a.channels.power!)).toBeCloseTo(199.764, 2)
    expect(plainMean(a.channels.speed!)).toBeCloseTo(1, 9)
    expect(plainMean(a.channels.altitude!)).toBeCloseTo(64.1644, 3)
    expect(a.channels.temperature).toBeUndefined()
    // relative timestamps: first 0, last 3600
    expect(hr.t[0]).toBe(0)
    expect(hr.t[hr.t.length - 1]).toBe(3600)
  })

  it('maps developer-field power (Stryd) when no native power exists', () => {
    const a = decodeFitActivity(fixtureBytes('user-run-2026-07-05.fit'), 'id-2')
    expect(a.sport).toBe('running')
    expect(a.device).toBe('fr255')
    expect(a.durationS).toBeCloseTo(3600.873, 3)
    const power = a.channels.power!
    expect(power.t.length).toBe(3602)
    expect(power.v[0]).toBe(221)
    expect(plainMean(power)).toBeCloseTo(213.5053, 3)
    expect(plainMean(a.channels.heartRate!)).toBeCloseTo(159.0147, 3)
    expect(plainMean(a.channels.speed!)).toBeCloseTo(2.5059, 3)
    // stride-sport cadence normalized to spm (manifest: 173.2274)
    expect(a.channels.cadence!.t.length).toBe(3602)
    expect(plainMean(a.channels.cadence!)).toBeCloseTo(173.2274, 3)
  })

  it('falls back gracefully when session messages are absent', () => {
    const a = decodeFitActivity(fixtureBytes('WithGearChangeData.fit'), 'id-3')
    expect(a.sport).toBe('unknown')
    expect(a.durationS).toBe(1978)
    expect(a.device).toBe('edge1040')
    expect(plainMean(a.channels.power!)).toBeCloseTo(120.4987, 3)
    // cadence is sparser than records — channels are independent
    expect(a.channels.cadence!.t.length).toBe(1954)
    // native rpm kept: sport is 'unknown' here, so no stride doubling
    expect(plainMean(a.channels.cadence!)).toBeCloseTo(82.7682, 3)
    expect(a.channels.heartRate!.t.length).toBe(1979)
  })

  it('extracts temperature when present', () => {
    const a = decodeFitActivity(fixtureBytes('HrmPluginTestActivity.fit'), 'id-4')
    expect(a.sport).toBe('walking')
    expect(a.device).toBe('fr955')
    expect(a.channels.temperature!.t.length).toBe(310)
    expect(plainMean(a.channels.temperature!)).toBeCloseTo(26.3065, 3)
  })

  it('decodes the long steady user run (manifest values)', () => {
    const a = decodeFitActivity(fixtureBytes('user-long-run-2025-04-26.fit'), 'id-7')
    expect(a.sport).toBe('running')
    expect(a.durationS).toBeCloseTo(10644.774, 2)
    expect(a.channels.heartRate!.t.length).toBe(10637)
    expect(plainMean(a.channels.heartRate!)).toBeCloseTo(165.6215, 3)
    expect(plainMean(a.channels.power!)).toBeCloseTo(301.2128, 3)
    expect(plainMean(a.channels.speed!)).toBeCloseTo(2.8149, 3)
  })

  it('preserves real recording gaps for the gap-aware stats (manifest values)', () => {
    const a = decodeFitActivity(fixtureBytes('user-gap-run-2026-07-02.fit'), 'id-8')
    expect(a.durationS).toBeCloseTo(2329.527, 2)
    const hr = a.channels.heartRate!
    expect(hr.t.length).toBe(2188)
    expect(plainMean(hr)).toBeCloseTo(143.787, 3)
    // manifest: one real 133 s recording gap, uncovered computed independently per §2.5
    expect(uncoveredS(hr, { startS: 0, endS: a.durationS })).toBeCloseTo(133, 3)
    expect(uncoveredS(a.channels.speed!, { startS: 0, endS: a.durationS })).toBeCloseTo(133, 3)
  })

  it('parses manual laps from the long run (manifest values)', () => {
    const a = decodeFitActivity(fixtureBytes('user-long-run-2025-04-26.fit'), 'id-laps')
    const manual = a.laps.filter((l) => l.trigger === 'manual')
    expect(manual).toHaveLength(3)
    expect(manual[0]!.range.startS).toBe(0)
    expect(manual[0]!.range.endS).toBeCloseTo(7511.275, 2)
    expect(manual[1]!.range).toEqual({ startS: 7511, endS: 9911 })
    expect(manual[2]!.range.startS).toBe(9911)
  })

  it('marks auto-lap runs as having no manual laps', () => {
    const a = decodeFitActivity(fixtureBytes('user-run-2026-07-05.fit'), 'id-auto')
    expect(a.laps.some((l) => l.trigger === 'manual')).toBe(false)
    expect(a.laps.length).toBeGreaterThan(0) // auto + sessionEnd still parsed
  })

  it('rejects a truncated FIT file', () => {
    expect(() => decodeFitActivity(fixtureBytes('corrupt.fit'), 'id-5')).toThrow(FitDecodeError)
  })

  it('rejects a non-FIT file', () => {
    expect(() => decodeFitActivity(fixtureBytes('not-a-fit.txt'), 'id-6')).toThrow(FitDecodeError)
  })
})
