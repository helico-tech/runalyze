// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AetTestResult, AntTestResult } from '../../../domain/model/types'
import { AdsVerdict } from './ads-verdict'

afterEach(cleanup)

const aet: AetTestResult = {
  kind: 'aet',
  id: 'a',
  activityId: 'act1',
  testDate: new Date('2026-06-01T08:00:00Z'),
  createdAt: new Date('2026-06-01T08:00:00Z'),
  window: { startS: 0, endS: 3600 },
  pace: { decouplingPct: 4.2, verdict: 'at-aet' },
  power: null,
  windowAvgHr: 148.2,
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

describe('AdsVerdict', () => {
  it('renders nothing when there are no tests', () => {
    const { container } = render(<AdsVerdict status={{ state: 'no-tests' }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('names the missing test', () => {
    render(<AdsVerdict status={{ state: 'missing-ant', aet }} />)
    expect(screen.getByText(/ant test still needed/i)).toBeInTheDocument()
  })

  it('shows the gap and a deficiency verdict when assessed', () => {
    render(
      <AdsVerdict
        status={{
          state: 'assessed',
          gapPct: 10.303,
          ads: true,
          aet,
          ant,
          aetStale: false,
          antStale: true,
        }}
      />,
    )
    expect(screen.getByText('10.3%')).toBeInTheDocument()
    expect(screen.getByText(/aerobic deficiency/i)).toBeInTheDocument()
  })

  it('reports balance when under threshold', () => {
    render(
      <AdsVerdict
        status={{
          state: 'assessed',
          gapPct: 9.09,
          ads: false,
          aet,
          ant,
          aetStale: false,
          antStale: false,
        }}
      />,
    )
    expect(screen.getByText(/balanced/i)).toBeInTheDocument()
  })
})
