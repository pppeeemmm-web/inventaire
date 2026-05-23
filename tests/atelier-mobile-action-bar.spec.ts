import { test, expect } from '@playwright/test'

/**
 * Ring A.1 / B.2 — narrow Atelier bottom field bar (+ new work on bar, hidden when drawer open).
 * Requires authenticated session — same as other ATELIER_E2E tests.
 */
test.describe('Atelier mobile action bar', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test.use({ viewport: { width: 375, height: 812 } })

  test('narrow atelier shows five-slot field bar including new work', async ({ page }) => {
    await page.goto('/atelier', { waitUntil: 'domcontentloaded' })
    const bar = page.getByTestId('atelier-mobile-action-bar')
    await expect(bar).toBeVisible({ timeout: 45_000 })
    await expect(page.getByTestId('atelier-mobile-bar-new-work')).toBeVisible()
  })

  test('narrow atelier header exposes hub launchpad', async ({ page }) => {
    await page.goto('/atelier/inventory', { waitUntil: 'domcontentloaded' })
    const hub = page.getByTestId('atelier-header-hub')
    await expect(hub).toBeVisible({ timeout: 45_000 })
    await hub.click()
    await expect(page).toHaveURL(/\/hub/)
  })
})
