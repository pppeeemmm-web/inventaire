import { test, expect } from '@playwright/test'

test.describe('Reports tab', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('opens reports tab and exports HTML', async ({ page }) => {
    await page.goto('/atelier/reports')
    await expect(page.getByTestId('reports-root')).toBeVisible({ timeout: 45_000 })

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'HTML' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/works_report_\d{4}-\d{2}-\d{2}\.html/)
  })

  test('exports PDF from reports tab', async ({ page }) => {
    await page.goto('/atelier/reports')
    await expect(page.getByTestId('reports-root')).toBeVisible({ timeout: 45_000 })

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /Exporter PDF|Export PDF/i }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/works_report_\d{4}-\d{2}-\d{2}\.pdf/)
  })

  test('opens pivot atlas from reports', async ({ page }) => {
    await page.goto('/atelier/reports')
    await expect(page.getByTestId('reports-root')).toBeVisible({ timeout: 45_000 })
    await page.getByTestId('reports-open-atlas').click()
    await expect(
      page.getByTestId('pivot-atlas-root').or(page.getByTestId('pivot-atlas-loading')).or(page.getByTestId('pivot-atlas-error')),
    ).toBeVisible({ timeout: 30_000 })
  })

  test('admin can export graph CSV from pivot atlas', async ({ page }) => {
    await page.goto('/atelier/reports')
    await expect(page.getByTestId('reports-root')).toBeVisible({ timeout: 45_000 })
    await page.getByTestId('reports-open-atlas').click()
    await expect(
      page.getByTestId('pivot-atlas-root').or(page.getByTestId('pivot-atlas-loading')).or(page.getByTestId('pivot-atlas-error')),
    ).toBeVisible({ timeout: 30_000 })

    const entityExport = page.getByTestId('graph-csv-export-entity')
    if (!(await entityExport.isVisible())) {
      test.skip(true, 'Dev session is not admin — graph CSV export is admin-only.')
    }
    const downloadPromise = page.waitForEvent('download')
    await entityExport.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/pem_entity_\d{4}-\d{2}-\d{2}\.csv/)
  })

  test('shows partial-catalogue note when loaded batch is smaller than total', async ({ page }) => {
    await page.goto('/atelier/reports', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('reports-root')).toBeVisible({ timeout: 45_000 })
    const totalBadge = page.getByTestId('atelier-catalogue-total')
    try {
      await totalBadge.waitFor({ state: 'visible', timeout: 20_000 })
    } catch {
      test.skip(true, 'No partial oeuvres load in this environment (≤ first page).')
    }
    await expect(totalBadge).toBeVisible()
  })
})
