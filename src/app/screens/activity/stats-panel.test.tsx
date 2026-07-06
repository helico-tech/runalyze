// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Sector } from '../../../domain/model/types'
import { makeSeries } from '../../../domain/model/series'
import { syntheticActivity, syntheticSeries } from '../../../domain/testing/synthetic'
import { StatsPanel } from './stats-panel'

afterEach(cleanup)

function activity() {
  return syntheticActivity({
    durationS: 3600,
    channels: {
      heartRate: syntheticSeries({ durationS: 3600, value: (t) => (t < 1800 ? 150 : 150 / 0.95) }),
      speed: syntheticSeries({ durationS: 3600, value: () => 3 }),
    },
  })
}
const sector: Sector = {
  id: 's1',
  activityId: 'test-activity',
  range: { startS: 0, endS: 3600 },
  label: '',
  kind: 'sector',
}

describe('StatsPanel', () => {
  it('shows whole-run averages', () => {
    render(
      <StatsPanel
        activity={activity()}
        sectors={[]}
        exclusions={{ warmupEndS: 0, cooldownStartS: 3600 }}
        selectedSectorId={null}
      />,
    )
    expect(screen.getByText(/whole run/i)).toBeInTheDocument()
  })

  it('shows sector decoupling for the selected sector', () => {
    render(
      <StatsPanel
        activity={activity()}
        sectors={[sector]}
        exclusions={{ warmupEndS: 0, cooldownStartS: 3600 }}
        selectedSectorId="s1"
      />,
    )
    // the synthetic HR climbs so decoupling ≈ 5.0%
    expect(screen.getByText(/decoupling/i)).toBeInTheDocument()
    expect(screen.getByText('5.0%')).toBeInTheDocument()
    expect(screen.getByText(/1st half/i)).toBeInTheDocument()
  })

  it('shows a GAP pace line when distance and altitude are present', () => {
    const t = Array.from({ length: 301 }, (_, i) => i)
    const a = syntheticActivity({
      durationS: 301,
      channels: {
        distance: makeSeries(t, t.map((s) => s * 3)),
        altitude: makeSeries(t, t.map(() => 100)),
        heartRate: makeSeries(t, t.map(() => 150)),
      },
    })
    render(<StatsPanel activity={a} sectors={[]} exclusions={a.exclusions} selectedSectorId={null} />)
    expect(screen.getByText('GAP')).toBeInTheDocument()
  })
})
