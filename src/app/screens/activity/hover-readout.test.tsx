// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { syntheticActivity, syntheticSeries } from '../../../domain/testing/synthetic'
import { createWorkspaceStore } from './workspace-store'
import { HoverReadout } from './hover-readout'

afterEach(cleanup)

function setup() {
  const a = syntheticActivity({
    durationS: 100,
    channels: { heartRate: syntheticSeries({ durationS: 100, value: () => 150 }) },
  })
  const store = createWorkspaceStore()
  store.getState().init(a, [])
  return { a, store }
}

describe('HoverReadout', () => {
  it('shows a hint when not hovering', () => {
    const { a, store } = setup()
    render(<HoverReadout activity={a} store={store} />)
    expect(screen.getByText(/hover a chart/i)).toBeInTheDocument()
  })

  it('shows channel values at the hover time', () => {
    const { a, store } = setup()
    store.getState().setHoverT(50)
    render(<HoverReadout activity={a} store={store} />)
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText(/0:50/)).toBeInTheDocument()
  })
})
