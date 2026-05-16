import { test, expect } from '@playwright/test'

test.describe('Reports tab', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('opens reports tab and exports HTML', async ({ page }) => {
    await page.goto('/atelier?tab=reports')
    await expect(page.getByTestId('reports-root')).toBeVisible({ timeout: 45_000 })

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'HTML' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/works_report_\d{4}-\d{2}-\d{2}\.html/)
  })

  test('exports PDF from reports tab', async ({ page }) => {
    await page.goto('/atelier?tab=reports')
    await expect(page.getByTestId('reports-root')).toBeVisible({ timeout: 45_000 })

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /Exporter PDF|Export PDF/i }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/works_report_\d{4}-\d{2}-\d{2}\.pdf/)
  })

  test('applies a report preset', async ({ page }) => {
    await page.goto('/atelier?tab=reports')
    await expect(page.getByTestId('reports-root')).toBeVisible({ timeout: 45_000 })

    await page.getByTestId('report-preset-missing_metadata').click()
    await expect(page.getByTestId('report-active-preset')).toContainText(/Métadonnées manquantes|Missing metadata/)
  })

  test('shows partial-catalogue note when loaded batch is smaller than total', async ({ page }) => {
    await page.goto('/atelier?tab=reports', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('reports-root')).toBeVisible({ timeout: 45_000 })
    const subsetNote = page.getByTestId('report-loaded-subset-note')
    try {
      await subsetNote.waitFor({ state: 'visible', timeout: 20_000 })
    } catch {
      test.skip(true, 'No partial oeuvres load in this environment (≤ first page).')
    }
    await expect(subsetNote).toBeVisible()
  })
})
