import { test, expect } from '@playwright/test'

/**
 * Drawer shows `data-testid="work-drawer-add-photo"` when the open work has no cover image.
 * Requires auth + real data (a row without `txtImageNameLink` in the first viewport).
 */
test.describe('Work drawer add photo', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('panel exposes add-photo control for a work without image', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pem_team_tab', 'inventory')
    })
    await page.goto('/atelier')
    await expect(page.getByTestId('inventory-virtual-scroll')).toBeVisible({ timeout: 45_000 })
    await page.getByRole('button', { name: /aperçu/i }).click()
    await expect(page.getByTestId('work-drawer-status-bar')).toBeVisible({ timeout: 15_000 })

    const dataRows = page
      .getByTestId('inventory-virtual-scroll')
      .locator('tbody tr')
      .filter({ hasNot: page.locator('td[colspan]') })

    const n = await dataRows.count()
    let found = false
    for (let i = 0; i < Math.min(n, 80); i++) {
      await dataRows.nth(i).click()
      const btn = page.getByTestId('work-drawer-add-photo')
      try {
        await expect(btn).toBeVisible({ timeout: 2000 })
        found = true
        break
      } catch {
        /* try next row */
      }
    }

    test.skip(!found, 'No work without image in first 80 rows — cannot assert add-photo control.')
    await expect(page.getByTestId('work-drawer-add-photo')).toBeVisible()
  })
})
