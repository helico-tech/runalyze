// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeSeries } from '../../../domain/model/series'
import { syntheticActivity } from '../../../domain/testing/synthetic'
import { SplitsPanel } from './splits-panel'

afterEach(cleanup)

function ramp() {
  const t = Array.from({ length: 901 }, (_, i) => i)
  return syntheticActivity({
    durationS: 901,
    channels: {
      distance: makeSeries(t, t.map((s) => s * 3)),
      heartRate: makeSeries(t, t.map(() => 150)),
      altitude: makeSeries(t, t.map(() => 100)),
    },
  })
}

describe('SplitsPanel', () => {
  it('renders a row per split with a partial tag on the last', () => {
    render(<SplitsPanel activity={ramp()} />)
    expect(screen.getByText('Splits')).toBeInTheDocument()
    expect(screen.getByText('partial')).toBeInTheDocument()
    // full splits render a clean km label; the partial row's cell is "3partial".
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders nothing without a distance channel', () => {
    const { container } = render(<SplitsPanel activity={syntheticActivity({ durationS: 100 })} />)
    expect(container).toBeEmptyDOMElement()
  })
})
