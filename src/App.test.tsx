// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from './App'

afterEach(cleanup)

describe('AppShell', () => {
  it('renders the brand header around its content', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <p>content here</p>
        </AppShell>
      </MemoryRouter>,
    )
    expect(screen.getByRole('banner')).toHaveTextContent(/runalyze/i)
    expect(screen.getByText('content here')).toBeInTheDocument()
  })
})
