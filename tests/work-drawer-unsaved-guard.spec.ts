import { test, expect } from '@playwright/test'

/**
 * Requires ATELIER_E2E=1 and a logged-in session (see inventory-virtual.spec.ts).
 */
test.describe('Work drawer unsaved guard', () => {
  test.skip(!process.env.ATELIER_E2E, 'Set ATELIER_E2E=1 with a logged-in app session.')

  test('switching list row prompts after editing title (inventory preview)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pem_team_tab', 'inventory')
    })
    await page.goto('/atelier')
    await expect(page.getByTestId('inventory-virtual-scroll')).toBeVisible({ timeout: 45_000 })

    const dataRows = page.locator('tbody tr').filter({ has: page.locator('button', { hasText: '✎' }) })
    await expect(dataRows.first()).toBeVisible({ timeout: 15_000 })
    const count = await dataRows.count()
    test.skip(count < 2, 'Need at least two inventory rows for this scenario.')

    await dataRows.nth(0).click()
    const titreField = page.locator('input[style*="font-size: 24"]').first()
    await expect(titreField).toBeVisible({ timeout: 10_000 })
    await titreField.fill('E2E UNSAVED GUARD')

    await dataRows.nth(1).click()

    await expect(page.getByText(/Modifications non enregistrées|Unsaved changes/)).toBeVisible()
  })
})
