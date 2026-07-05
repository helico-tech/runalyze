// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Lap } from '../../../domain/model/types'
import { syntheticActivity, syntheticSeries } from '../../../domain/testing/synthetic'
import { LapTable } from './lap-table'

afterEach(cleanup)

const laps: Lap[] = [
  { index: 0, range: { startS: 0, endS: 600 }, trigger: 'manual' },
  { index: 1, range: { startS: 600, endS: 1200 }, trigger: 'auto' },
]

describe('LapTable', () => {
  it('lists only manual laps with per-lap stats', () => {
    const a = syntheticActivity({
      durationS: 1200,
      laps,
      channels: { heartRate: syntheticSeries({ durationS: 1200, value: () => 150 }) },
    })
    render(<LapTable activity={a} />)
    expect(screen.getByText('L1')).toBeInTheDocument()
    expect(screen.queryByText('L2')).not.toBeInTheDocument() // auto lap excluded
    expect(screen.getByText('150 bpm')).toBeInTheDocument()
    expect(screen.getByText('10:00')).toBeInTheDocument() // 600 s duration
  })

  it('renders nothing without manual laps', () => {
    const a = syntheticActivity({ durationS: 60 })
    const { container } = render(<LapTable activity={a} />)
    expect(container).toBeEmptyDOMElement()
  })
})
