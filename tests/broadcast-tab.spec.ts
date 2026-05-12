import { test, expect } from '@playwright/test'

/**
 * Atelier > Diffusion > Broadcast (`?tab=broadcast`).
 * Requires `/atelier` auth — same pattern as other atelier E2E tests.
 */
test.describe('Broadcast tab', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('deep link loads panel: admin subtabs or editor admin-only gate', async ({ page }) => {
    await page.goto('/atelier?tab=broadcast')
    await expect(page.getByTestId('broadcast-tab-root')).toBeVisible({ timeout: 45_000 })

    const adminOnly = page.getByTestId('broadcast-tab-admin-only')
    const queueSub = page.getByTestId('broadcast-subtab-queue')
    await expect(adminOnly.or(queueSub)).toBeVisible({ timeout: 20_000 })

    if (await adminOnly.isVisible().catch(() => false)) {
      await expect(adminOnly).toBeVisible()
      return
    }

    await expect(queueSub).toBeVisible()
    await expect(page.getByTestId('broadcast-subtab-posted')).toBeVisible()
    await expect(page.getByTestId('broadcast-subtab-activity')).toBeVisible()
    await page.getByTestId('broadcast-subtab-posted').click()
    await page.getByTestId('broadcast-subtab-activity').click()
    await expect(page.getByTestId('broadcast-filter-vip')).toBeVisible()
    await page.getByTestId('broadcast-filter-all').click()
    await page.getByTestId('broadcast-filter-vip').click()
    await page.getByTestId('broadcast-reload').click()
  })
})
