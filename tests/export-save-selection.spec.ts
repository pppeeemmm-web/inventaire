import { test, expect } from '@playwright/test'

/**
 * Requires an authenticated session for `/atelier` (Supabase middleware).
 * Run locally: `ATELIER_E2E=1 npm run dev` then `ATELIER_E2E=1 npm run test:e2e`
 */
test.describe('Export save-selection dialog', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('opens save-selection step after choosing Export', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pem_team_tab', 'inventory')
    })
    await page.goto('/atelier')
    await expect(page.getByTestId('inventory-virtual-scroll')).toBeVisible({ timeout: 45_000 })

    const table = page.getByTestId('inventory-virtual-scroll')
    const firstWorkRow = table.locator('tbody tr').filter({ has: page.locator('td:nth-child(6)') }).first()
    await firstWorkRow.locator('td').first().locator('div').click()

    await page.getByTestId('curation-open-export').click()

    await expect(page.getByTestId('export-open-save-dialog')).toBeVisible()
    await page.getByTestId('export-open-save-dialog').click()

    await expect(page.getByTestId('export-save-selection-dialog')).toBeVisible()
    await expect(page.getByTestId('export-save-nothing')).toBeVisible()
    await expect(page.getByTestId('export-save-theme')).toBeVisible()
    await expect(page.getByTestId('export-save-group')).toBeVisible()
    await expect(page.getByTestId('export-save-continue')).toBeVisible()
  })
})
