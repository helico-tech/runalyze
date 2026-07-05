// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FakeImageRenderer } from '../../adapters/export/fake-image-renderer'
import { ExportPreview } from './export-preview'

afterEach(cleanup)

describe('ExportPreview', () => {
  it('rasterizes the card and reports success', async () => {
    const renderer = new FakeImageRenderer()
    render(
      <ExportPreview filename="test.png" renderer={renderer} onClose={vi.fn()}>
        <div data-export-card>card</div>
      </ExportPreview>,
    )
    await userEvent.click(screen.getByRole('button', { name: /download png/i }))
    await waitFor(() => expect(renderer.lastNode).not.toBeNull())
    expect(await screen.findByText(/saved/i)).toBeInTheDocument()
  })

  it('closes', async () => {
    const onClose = vi.fn()
    render(
      <ExportPreview filename="x.png" renderer={new FakeImageRenderer()} onClose={onClose}>
        <div data-export-card>card</div>
      </ExportPreview>,
    )
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
