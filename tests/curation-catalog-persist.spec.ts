import { test, expect } from '@playwright/test'

/**
 * Requires an authenticated session for `/atelier` (Supabase middleware).
 */
test.describe('Curation dock catalog persist', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('opens catalog persist dialog from dock', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pem_team_tab', 'inventory')
    })
    await page.goto('/atelier')
    await expect(page.getByTestId('inventory-virtual-scroll')).toBeVisible({ timeout: 45_000 })

    const table = page.getByTestId('inventory-virtual-scroll')
    const firstWorkRow = table.locator('tbody tr').filter({ has: page.locator('td:nth-child(6)') }).first()
    await firstWorkRow.locator('td').first().locator('div').click()

    await page.getByTestId('curation-open-catalog-persist').click()

    await expect(page.getByTestId('catalog-persist-dialog')).toBeVisible()
    await expect(page.getByTestId('catalog-persist-theme')).toBeVisible()
    await expect(page.getByTestId('catalog-persist-group')).toBeVisible()
    await expect(page.getByTestId('catalog-persist-confirm')).toBeVisible()
  })
})
