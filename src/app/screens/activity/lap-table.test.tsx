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
  { index: 2, range: { startS: 1200, endS: 1260 }, trigger: 'session-end' },
]

describe('LapTable', () => {
  it('lists manual and auto laps with a type tag, dropping session-end', () => {
    const a = syntheticActivity({
      durationS: 1260,
      laps,
      channels: { heartRate: syntheticSeries({ durationS: 1260, value: () => 150 }) },
    })
    render(<LapTable activity={a} />)
    expect(screen.getByText('L1')).toBeInTheDocument()
    expect(screen.getByText('L2')).toBeInTheDocument()
    expect(screen.queryByText('L3')).not.toBeInTheDocument() // session-end dropped
    expect(screen.getByText('manual')).toBeInTheDocument()
    expect(screen.getByText('auto')).toBeInTheDocument()
    expect(screen.getAllByText('10:00').length).toBe(2) // both laps are 600 s
  })

  it('renders nothing without laps', () => {
    const a = syntheticActivity({ durationS: 60 })
    const { container } = render(<LapTable activity={a} />)
    expect(container).toBeEmptyDOMElement()
  })
})
