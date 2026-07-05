// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotesPanel } from './notes-panel'

afterEach(cleanup)

describe('NotesPanel', () => {
  it('debounces and saves typed text', async () => {
    const onSave = vi.fn()
    render(<NotesPanel initialText="" onSave={onSave} />)
    await userEvent.type(screen.getByRole('textbox'), 'felt strong')
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('felt strong'), { timeout: 1500 })
  })

  it('renders the initial text', () => {
    render(<NotesPanel initialText="prior note" onSave={vi.fn()} />)
    expect(screen.getByRole('textbox')).toHaveValue('prior note')
  })
})
