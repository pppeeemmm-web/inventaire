import { test, expect } from '@playwright/test'

/** Ring B.2 — bottom action bar on narrow Atelier (hidden when WorkDrawer open). */
test.describe('Atelier mobile action bar', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test.use({ viewport: { width: 375, height: 812 } })

  test('narrow atelier shows four-button mobile action bar', async ({ page }) => {
    await page.goto('/atelier?tab=inventory')
    const bar = page.getByTestId('atelier-mobile-action-bar')
    await expect(bar).toBeVisible({ timeout: 45_000 })
    await expect(bar.locator('button')).toHaveCount(4)
  })

  test('scan button opens atelier scan route', async ({ page }) => {
    await page.goto('/atelier?tab=inventory')
    await expect(page.getByTestId('atelier-mobile-action-bar')).toBeVisible({ timeout: 45_000 })
    await page.getByLabel(/QR scan|Scanner QR/i).first().click()
    await expect(page).toHaveURL(/\/atelier\/scan/)
  })
})
