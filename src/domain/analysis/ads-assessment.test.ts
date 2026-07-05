import { describe, expect, it } from 'vitest'
import type { AetTestResult, AntTestResult } from '../model/types'
import { assessAds } from './ads-assessment'

const NOW = new Date('2026-07-05T00:00:00Z')

function aet(over: Partial<AetTestResult>): AetTestResult {
  return {
    kind: 'aet',
    id: 'a1',
    activityId: 'act1',
    testDate: new Date('2026-06-01T08:00:00Z'),
    createdAt: new Date('2026-06-01T10:00:00Z'),
    window: { startS: 600, endS: 4200 },
    pace: { decouplingPct: 4.2, verdict: 'at-aet' },
    power: null,
    windowAvgHr: 148.2,
    aetHr: 148,
    ...over,
  }
}

function ant(over: Partial<AntTestResult>): AntTestResult {
  return {
    kind: 'ant',
    id: 'n1',
    activityId: 'act2',
    testDate: new Date('2026-06-15T08:00:00Z'),
    createdAt: new Date('2026-06-15T10:00:00Z'),
    window: { startS: 0, endS: 1800 },
    antHr: 165,
    windowAvgHr: 163.7,
    windowAvgSpeed: 3.4,
    windowAvgPower: null,
    ...over,
  }
}

describe('assessAds', () => {
  it('handles no tests', () => {
    expect(assessAds([], NOW)).toEqual({ state: 'no-tests' })
  })

  it('reports the missing side', () => {
    expect(assessAds([aet({})], NOW).state).toBe('missing-ant')
    expect(assessAds([ant({})], NOW).state).toBe('missing-aet')
  })

  it('ignores AeT results without an accepted AeT HR', () => {
    expect(assessAds([aet({ aetHr: null }), ant({})], NOW).state).toBe('missing-aet')
  })

  it('assesses ADS when the gap exceeds 10%', () => {
    const s = assessAds([aet({ aetHr: 148 }), ant({ antHr: 165 })], NOW)
    expect(s.state).toBe('assessed')
    if (s.state !== 'assessed') return
    expect(s.gapPct).toBeCloseTo(((165 - 148) / 165) * 100, 6) // 10.303...
    expect(s.ads).toBe(true)
  })

  it('is balanced at or below 10%', () => {
    const under = assessAds([aet({ aetHr: 150 }), ant({ antHr: 165 })], NOW)
    if (under.state !== 'assessed') throw new Error('expected assessed')
    expect(under.ads).toBe(false) // 9.09%
    const exact = assessAds([aet({ aetHr: 144 }), ant({ antHr: 160 })], NOW)
    if (exact.state !== 'assessed') throw new Error('expected assessed')
    expect(exact.gapPct).toBeCloseTo(10, 9)
    expect(exact.ads).toBe(false) // exactly 10 is not ADS
  })

  it('picks the most recent result per side', () => {
    const s = assessAds(
      [
        aet({ id: 'old', testDate: new Date('2026-05-01T08:00:00Z'), aetHr: 140 }),
        aet({ id: 'new', testDate: new Date('2026-06-01T08:00:00Z'), aetHr: 148 }),
        ant({}),
      ],
      NOW,
    )
    if (s.state !== 'assessed') throw new Error('expected assessed')
    expect(s.aet.id).toBe('new')
  })

  it('marks staleness strictly beyond 90 days', () => {
    const fresh = assessAds([aet({ testDate: new Date('2026-04-06T00:00:01Z') }), ant({})], NOW)
    if (fresh.state !== 'assessed') throw new Error('expected assessed')
    expect(fresh.aetStale).toBe(false)
    const stale = assessAds([aet({ testDate: new Date('2026-04-05T23:59:59Z') }), ant({})], NOW)
    if (stale.state !== 'assessed') throw new Error('expected assessed')
    expect(stale.aetStale).toBe(true)
    expect(stale.antStale).toBe(false)
  })
})
