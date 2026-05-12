import { test, expect } from '@playwright/test'

/**
 * Batch edit modal — `broadcast_ready` tri-field (`data-testid="batch-broadcast-ready-tri"`).
 * Requires `/atelier` auth and at least one row in inventory.
 */
test.describe('Batch edit broadcast-ready', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('inventory: open batch modal and see broadcast-ready control', async ({ page }) => {
    await page.goto('/atelier')
    await page.getByRole('button', { name: /Inventaire|Inventory/i }).click()
    await page.getByTestId('inventory-virtual-scroll').waitFor({ state: 'visible', timeout: 45_000 })
    await page.locator('[data-testid="inventory-virtual-scroll"] tbody tr').first().locator('td').first().click()
    await page.getByTestId('curation-open-batch').click()
    await expect(page.getByTestId('batch-broadcast-ready-tri')).toBeVisible({ timeout: 15_000 })
  })
})
