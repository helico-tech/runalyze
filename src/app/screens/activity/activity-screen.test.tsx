// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GarminFitFileParser } from '../../../adapters/fit/fit-file-parser'
import { InMemoryLibraryRepository } from '../../../adapters/storage/in-memory-library-repository'
import { fixtureBytes } from '../../../adapters/testing/fixtures'
import { ContainerProvider } from '../../container-context'
import { ActivityScreen } from './activity-screen'

afterEach(cleanup)

async function seed() {
  const repo = new InMemoryLibraryRepository()
  const parser = new GarminFitFileParser()
  const [outcome] = await parser.parse(fixtureBytes('Activity.fit'), 'Activity.fit')
  if (!outcome!.ok) throw new Error('fixture parse failed')
  await repo.saveActivity(outcome!.activity, outcome!.rawBytes)
  return { repo, parser, id: outcome!.activity.id }
}

function renderAt(
  container: { repo: InMemoryLibraryRepository; parser: GarminFitFileParser },
  id: string,
) {
  render(
    <MemoryRouter initialEntries={[`/activity/${id}`]}>
      <ContainerProvider container={{ ...container, persistent: true }}>
        <Routes>
          <Route path="/activity/:id" element={<ActivityScreen />} />
        </Routes>
      </ContainerProvider>
    </MemoryRouter>,
  )
}

describe('ActivityScreen workspace', () => {
  it('loads the run and shows the channel rail and stats', async () => {
    const { repo, parser, id } = await seed()
    renderAt({ repo, parser }, id)
    expect(await screen.findByText(/whole run/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /heart rate/i })).toBeInTheDocument()
  })

  it('persists a note through the repository', async () => {
    const { repo, parser, id } = await seed()
    renderAt({ repo, parser }, id)
    const textbox = await screen.findByRole('textbox')
    await userEvent.type(textbox, 'tempo run')
    await waitFor(async () => expect((await repo.getNote(id))?.text).toBe('tempo run'), {
      timeout: 2000,
    })
  })

  it('shows a not-found message for a missing id', async () => {
    const { repo, parser } = await seed()
    renderAt({ repo, parser }, 'nonexistent')
    expect(await screen.findByText(/run not found/i)).toBeInTheDocument()
  })
})
