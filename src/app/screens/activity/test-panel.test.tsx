// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TestResult } from '../../../domain/model/types'
import { syntheticActivity, syntheticSeries } from '../../../domain/testing/synthetic'
import { TestPanel } from './test-panel'

afterEach(cleanup)

function aetActivity() {
  return syntheticActivity({
    durationS: 5400,
    channels: {
      speed: syntheticSeries({ durationS: 5400, value: () => 3 }),
      heartRate: syntheticSeries({
        durationS: 5400,
        value: (t) => (t < 2400 ? 150 : 150 / 0.95),
      }),
    },
  })
}

describe('TestPanel AeT', () => {
  it('shows a live at-aet verdict and saves a result', async () => {
    const onSave = vi.fn<(r: TestResult) => void>()
    render(
      <TestPanel
        activity={aetActivity()}
        kind="aet"
        window={{ startS: 600, endS: 4200 }}
        driftChannel="speed"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('5.0%')).toBeInTheDocument()
    expect(screen.getByText('At AeT')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /save result/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0]![0]
    expect(saved.kind).toBe('aet')
    if (saved.kind === 'aet') expect(saved.aetHr).toBe(154)
  })

  it('disables save for a too-short window', () => {
    render(
      <TestPanel
        activity={aetActivity()}
        kind="aet"
        window={{ startS: 600, endS: 1200 }}
        driftChannel="speed"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText(/too short/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save result/i })).toBeDisabled()
  })
})

describe('TestPanel AnT', () => {
  it('shows the AnT HR from the final 20 minutes and saves', async () => {
    const onSave = vi.fn<(r: TestResult) => void>()
    const a = syntheticActivity({
      durationS: 1800,
      channels: {
        heartRate: syntheticSeries({ durationS: 1800, value: (t) => (t < 600 ? 155 : 168) }),
        speed: syntheticSeries({ durationS: 1800, value: () => 3.4 }),
      },
    })
    render(
      <TestPanel
        activity={a}
        kind="ant"
        window={{ startS: 0, endS: 1800 }}
        driftChannel="speed"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText(/168/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /save result/i }))
    const saved = onSave.mock.calls[0]![0]
    expect(saved.kind).toBe('ant')
    if (saved.kind === 'ant') expect(saved.antHr).toBe(168)
  })
})
