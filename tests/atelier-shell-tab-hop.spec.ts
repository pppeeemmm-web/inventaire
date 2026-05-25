import { test, expect } from '@playwright/test'

/**
 * Portal layout keeps TeamPortalClient mounted — segment tab hops must not replay boot splash.
 * Requires ATELIER_E2E=1 and admin (audit tab).
 */
test.describe('Atelier shell tab hop', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('inventory → audit → inventory without boot splash replay', async ({ page }) => {
    await page.goto('/atelier/inventory')
    await page.getByTestId('inventory-virtual-scroll').waitFor({ state: 'visible', timeout: 45_000 })
    await expect(page.getByTestId('atelier-boot-splash')).toHaveCount(0)

    await page.getByTestId('atelier-nav-groups').getByRole('button', { name: /Audit/i }).click()
    await page.getByTestId('audit-tab-root').waitFor({ state: 'visible', timeout: 30_000 })
    await expect(page.getByTestId('atelier-boot-splash')).toHaveCount(0)

    await page.getByTestId('atelier-nav-groups').getByRole('button', { name: /Inventaire|Inventory/i }).click()
    await page.getByTestId('inventory-virtual-scroll').waitFor({ state: 'visible', timeout: 30_000 })
    await expect(page.getByTestId('atelier-boot-splash')).toHaveCount(0)
  })
})
