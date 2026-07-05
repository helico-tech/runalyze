// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { GarminFitFileParser } from '../../../adapters/fit/fit-file-parser'
import { InMemoryLibraryRepository } from '../../../adapters/storage/in-memory-library-repository'
import { fixtureBytes } from '../../../adapters/testing/fixtures'
import { FakeImageRenderer } from '../../../adapters/export/fake-image-renderer'
import { App } from '../../../App'
import { ContainerProvider } from '../../container-context'
import { LibraryScreen } from './library-screen'

afterEach(cleanup)

function makeContainer(persistent = true) {
  return {
    parser: new GarminFitFileParser(),
    repo: new InMemoryLibraryRepository(),
    renderer: new FakeImageRenderer(),
    persistent,
  }
}

function renderScreen(persistent = true) {
  const container = makeContainer(persistent)
  render(
    <MemoryRouter>
      <ContainerProvider container={container}>
        <LibraryScreen />
      </ContainerProvider>
    </MemoryRouter>,
  )
  return container
}

describe('LibraryScreen', () => {
  it('shows empty states initially', async () => {
    renderScreen()
    expect(await screen.findByText(/no runs yet/i)).toBeInTheDocument()
    expect(screen.getByText(/run an aet test to begin/i)).toBeInTheDocument()
  })

  it('imports a dropped FIT file and lists the run', async () => {
    renderScreen()
    const bytes = fixtureBytes('Activity.fit')
    const file = new File([bytes as BlobPart], 'Activity.fit')
    const input = screen.getByTestId('file-input')
    await userEvent.upload(input as HTMLInputElement, file)
    await waitFor(() => expect(screen.getByText('2021-07-20')).toBeInTheDocument())
    expect(screen.getByText('1:00:01')).toBeInTheDocument() // durationS 3601
  })

  it('deletes a run after confirmation', async () => {
    const container = makeContainer(true)
    const [outcome] = await container.parser.parse(fixtureBytes('Activity.fit'), 'Activity.fit')
    if (!outcome!.ok) throw new Error('parse failed')
    await container.repo.saveActivity(outcome!.activity, outcome!.rawBytes)
    render(
      <MemoryRouter>
        <ContainerProvider container={container}>
          <LibraryScreen />
        </ContainerProvider>
      </MemoryRouter>,
    )
    await screen.findByText('2021-07-20')
    await userEvent.click(screen.getByRole('button', { name: /delete run/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }))
    await waitFor(async () => expect(await container.repo.listActivities()).toHaveLength(0))
  })
})

describe('App session banner', () => {
  it('warns persistently when storage is session-only', async () => {
    render(
      <MemoryRouter>
        <ContainerProvider container={makeContainer(false)}>
          <App />
        </ContainerProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByText(/won't be saved/i)).toBeInTheDocument()
  })
})
