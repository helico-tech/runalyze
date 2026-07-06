import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const fixture = (name: string) => fileURLToPath(new URL(`../tests/fixtures/${name}`, import.meta.url))

const RUN = 'user-run-2026-07-05.fit'

// Each test runs in a fresh, isolated browser context, so IndexedDB starts empty —
// no manual clear is needed (and an addInitScript clear would re-run on reload,
// wiping persisted state before the app reads it).
test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

async function openRun(page: import('@playwright/test').Page) {
  await page.setInputFiles('[data-testid=file-input]', fixture(RUN))
  // The run-row link (not the "Imported…" toast, which also contains the date).
  await page.getByRole('link', { name: '2026-07-05' }).click()
  await page.waitForSelector('.u-over')
}

test('import a run and run an AeT test with a live verdict', async ({ page }) => {
  await openRun(page)
  await page.getByRole('button', { name: 'AeT test' }).click()
  await expect(page.getByText('At AeT', { exact: true })).toBeVisible()
  await expect(page.getByText('3.6%')).toBeVisible()
})

test('a saved test drives the Trends screen', async ({ page }) => {
  await openRun(page)
  await page.getByRole('button', { name: 'AeT test' }).click()
  await page.getByRole('button', { name: 'Save result' }).click()
  await page.getByRole('link', { name: 'Trends' }).click()
  await expect(page.getByText('AeT HR')).toBeVisible()
  await expect(page.getByText('Test log')).toBeVisible()
})

test('notes persist across reload', async ({ page }) => {
  await openRun(page)
  // Scoped by placeholder: the zones panel's threshold inputs are also
  // (unnamed) textboxes on this screen, so a bare getByRole('textbox') is
  // ambiguous now.
  const notes = page.getByPlaceholder(/how did it feel/i)
  await notes.fill('tempo effort')
  await page.waitForTimeout(700) // debounce
  await page.reload()
  await expect(page.getByPlaceholder(/how did it feel/i)).toHaveValue('tempo effort')
})

test('export produces a PNG download', async ({ page }) => {
  await openRun(page)
  await page.getByRole('button', { name: 'AeT test' }).click()
  await page.getByRole('button', { name: 'Export' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /download png/i }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/\.png$/)
})

test('setting thresholds populates the zones bar', async ({ page }) => {
  await openRun(page)
  // Before thresholds: the prompt is shown.
  await expect(page.getByText(/set your thresholds/i)).toBeVisible()
  await page.getByTestId('aet-input').fill('145')
  await page.getByTestId('ant-input').fill('170')
  await page.getByRole('button', { name: 'Save' }).click()
  // After saving: the zone legend appears.
  await expect(page.getByText('Below AeT')).toBeVisible()
  await expect(page.getByText('Above AnT')).toBeVisible()
})
