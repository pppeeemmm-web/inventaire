import { test, expect } from '@playwright/test'

/**
 * Batch edit modal — portaled overlay must accept clicks (broadcast_ready tri-field).
 * Requires `/atelier` auth and at least one row in inventory.
 */
test.describe('Batch edit broadcast-ready', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('inventory: open batch modal, tri-field responds to click', async ({ page }) => {
    await page.goto('/atelier/inventory')
    await page.getByTestId('inventory-virtual-scroll').waitFor({ state: 'visible', timeout: 45_000 })
    await page.locator('[data-testid="inventory-virtual-scroll"] tbody tr').first().locator('td').first().click()
    await page.getByTestId('curation-open-batch').click()

    const tri = page.getByTestId('batch-broadcast-ready-tri')
    await expect(tri).toBeVisible({ timeout: 15_000 })
    // Flags matrix (B2 2026-11-13): — / Yes / No segments; starts on "—" (unchanged).
    await expect(tri.getByRole('radio', { name: '—' })).toHaveAttribute('aria-checked', 'true')

    const yes = tri.getByRole('radio', { name: /Oui|Yes/ })
    await yes.click()
    await expect(yes).toHaveAttribute('aria-checked', 'true')

    await page.getByRole('button', { name: /Annuler|Cancel/i }).click()
    await expect(tri).toHaveCount(0)
  })
})
