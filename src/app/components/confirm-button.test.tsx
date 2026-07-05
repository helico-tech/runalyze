// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmButton } from './confirm-button'

afterEach(cleanup)

describe('ConfirmButton', () => {
  it('requires two clicks to confirm', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmButton label="Delete" confirmLabel="Confirm?" onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm?' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
