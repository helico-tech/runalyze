// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { AetTestResult } from '../../../domain/model/types'
import { InMemoryLibraryRepository } from '../../../adapters/storage/in-memory-library-repository'
import { GarminFitFileParser } from '../../../adapters/fit/fit-file-parser'
import { FakeImageRenderer } from '../../../adapters/export/fake-image-renderer'
import { ContainerProvider } from '../../container-context'
import { TrendsScreen } from './trends-screen'

afterEach(cleanup)

function renderTrends(repo: InMemoryLibraryRepository) {
  render(
    <MemoryRouter>
      <ContainerProvider
        container={{
          repo,
          parser: new GarminFitFileParser(),
          renderer: new FakeImageRenderer(),
          persistent: true,
        }}
      >
        <TrendsScreen />
      </ContainerProvider>
    </MemoryRouter>,
  )
}

describe('TrendsScreen', () => {
  it('shows an empty state with no test history', async () => {
    renderTrends(new InMemoryLibraryRepository())
    expect(await screen.findByText(/no test history yet/i)).toBeInTheDocument()
  })

  it('renders the AeT HR trend after a result exists', async () => {
    const repo = new InMemoryLibraryRepository()
    const aet: AetTestResult = {
      kind: 'aet',
      id: 'a1',
      activityId: 'act1',
      testDate: new Date('2026-06-01T08:00:00Z'),
      createdAt: new Date('2026-06-01T08:00:00Z'),
      window: { startS: 0, endS: 3600 },
      pace: { decouplingPct: 4.2, verdict: 'at-aet' },
      power: null,
      windowAvgHr: 148,
      aetHr: 148,
    }
    await repo.saveTestResult(aet)
    renderTrends(repo)
    expect(await screen.findByText(/aet hr/i)).toBeInTheDocument()
  })
})
