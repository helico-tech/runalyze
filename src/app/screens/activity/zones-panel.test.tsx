// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeSeries } from '../../../domain/model/series'
import { syntheticActivity } from '../../../domain/testing/synthetic'
import { ZonesPanel } from './zones-panel'

afterEach(cleanup)

function hrActivity() {
  const t = Array.from({ length: 300 }, (_, i) => i)
  return syntheticActivity({
    durationS: 300,
    channels: { heartRate: makeSeries(t, t.map((s) => (s < 150 ? 130 : 175))) },
  })
}

describe('ZonesPanel', () => {
  it('prompts for thresholds when none are resolved', () => {
    render(<ZonesPanel activity={hrActivity()} thresholds={null} tests={[]} onSave={() => {}} />)
    expect(screen.getByText(/set your thresholds/i)).toBeInTheDocument()
  })

  it('draws the bar when thresholds resolve', () => {
    const thresholds = { aetHr: 140, antHr: 170, updatedAt: new Date('2026-07-06T00:00:00Z') }
    render(<ZonesPanel activity={hrActivity()} thresholds={thresholds} tests={[]} onSave={() => {}} />)
    expect(screen.getByText('Below AeT')).toBeInTheDocument()
    expect(screen.getByText('Above AnT')).toBeInTheDocument()
  })

  it('saves edited thresholds', async () => {
    const onSave = vi.fn()
    render(<ZonesPanel activity={hrActivity()} thresholds={null} tests={[]} onSave={onSave} />)
    await userEvent.type(screen.getByTestId('aet-input'), '145')
    await userEvent.type(screen.getByTestId('ant-input'), '168')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith(145, 168)
  })
})
