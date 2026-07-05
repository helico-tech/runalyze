// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AetTestResult, AntTestResult } from '../../domain/model/types'
import { syntheticActivity, syntheticSeries } from '../../domain/testing/synthetic'
import { AdsExportCard, TestExportCard } from './export-card'

afterEach(cleanup)

const aet: AetTestResult = {
  kind: 'aet',
  id: 'a1',
  activityId: 'test-activity',
  testDate: new Date('2026-07-05T06:45:13.000Z'),
  createdAt: new Date('2026-07-05T09:00:00.000Z'),
  window: { startS: 0, endS: 3600 },
  driftChannel: 'speed',
  decouplingPct: 3.56,
  windowAvgHr: 159,
  verdict: 'at-aet',
  aetHr: 159,
}
const ant: AntTestResult = {
  kind: 'ant',
  id: 'n1',
  activityId: 'test-activity',
  testDate: new Date('2026-07-06T06:45:13.000Z'),
  createdAt: new Date('2026-07-06T09:00:00.000Z'),
  window: { startS: 0, endS: 1800 },
  antHr: 173,
  windowAvgHr: 170,
  windowAvgSpeed: null,
  windowAvgPower: null,
}

function activity() {
  return syntheticActivity({
    durationS: 3600,
    channels: {
      heartRate: syntheticSeries({ durationS: 3600, value: () => 159 }),
      speed: syntheticSeries({ durationS: 3600, value: () => 2.5 }),
    },
  })
}

describe('TestExportCard', () => {
  it('renders the verdict, numbers, and brand', () => {
    render(<TestExportCard activity={activity()} result={aet} />)
    expect(screen.getByText(/runalyze/i)).toBeInTheDocument()
    expect(screen.getByText('3.6%')).toBeInTheDocument()
    expect(screen.getByText('At AeT')).toBeInTheDocument()
    expect(screen.getAllByText('159 bpm').length).toBeGreaterThan(0)
    expect(screen.getByText('2026-07-05')).toBeInTheDocument()
  })
})

describe('AdsExportCard', () => {
  it('renders the gap and verdict', () => {
    render(
      <AdsExportCard
        status={{
          state: 'assessed',
          gapPct: 8.2,
          ads: false,
          aet,
          ant,
          aetStale: false,
          antStale: false,
        }}
      />,
    )
    expect(screen.getByText('8.2%')).toBeInTheDocument()
    expect(screen.getByText(/balanced/i)).toBeInTheDocument()
  })
})
