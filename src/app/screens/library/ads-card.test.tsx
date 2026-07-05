// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AetTestResult, AntTestResult } from '../../../domain/model/types'
import { AdsCard } from './ads-card'

afterEach(cleanup)

const NOW = new Date('2026-07-05T00:00:00Z')

const aet: AetTestResult = {
  kind: 'aet',
  id: 'a',
  activityId: 'act1',
  testDate: new Date('2026-06-01T08:00:00Z'),
  createdAt: new Date('2026-06-01T08:00:00Z'),
  window: { startS: 0, endS: 3600 },
  driftChannel: 'speed',
  decouplingPct: 4.2,
  windowAvgHr: 148.2,
  verdict: 'at-aet',
  aetHr: 148,
}
const ant: AntTestResult = {
  kind: 'ant',
  id: 'n',
  activityId: 'act2',
  testDate: new Date('2026-06-15T08:00:00Z'),
  createdAt: new Date('2026-06-15T08:00:00Z'),
  window: { startS: 0, endS: 1800 },
  antHr: 165,
  windowAvgHr: 163.7,
  windowAvgSpeed: null,
  windowAvgPower: null,
}

describe('AdsCard', () => {
  it('invites action when no tests exist', () => {
    render(<AdsCard status={{ state: 'no-tests' }} now={NOW} />)
    expect(screen.getByText(/run an aet test to begin/i)).toBeInTheDocument()
  })

  it('names the missing test', () => {
    render(<AdsCard status={{ state: 'missing-ant', aet }} now={NOW} />)
    expect(screen.getByText(/ant test still needed/i)).toBeInTheDocument()
  })

  it('shows gap, verdict, ages, and provenance when assessed', () => {
    render(
      <AdsCard
        status={{
          state: 'assessed',
          gapPct: 10.303,
          ads: true,
          aet,
          ant,
          aetStale: false,
          antStale: true,
        }}
        now={NOW}
      />,
    )
    expect(screen.getByText('10.3%')).toBeInTheDocument()
    expect(screen.getByText(/aerobic deficiency/i)).toBeInTheDocument()
    expect(screen.getByText(/148 bpm/)).toBeInTheDocument()
    expect(screen.getByText(/165 bpm/)).toBeInTheDocument()
    expect(screen.getByText(/33 d ago/)).toBeInTheDocument() // AeT 2026-06-01 08:00 vs NOW
    expect(screen.getByText(/retest suggested/i)).toBeInTheDocument()
  })

  it('reports balance when under threshold', () => {
    render(
      <AdsCard
        status={{
          state: 'assessed',
          gapPct: 9.09,
          ads: false,
          aet,
          ant,
          aetStale: false,
          antStale: false,
        }}
        now={NOW}
      />,
    )
    expect(screen.getByText(/balanced/i)).toBeInTheDocument()
  })
})
