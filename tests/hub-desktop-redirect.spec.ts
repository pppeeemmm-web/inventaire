import { test, expect } from '@playwright/test'

/**
 * Hub is the mobile/PWA field launcher. Desktop users should land in the
 * canonical Atelier overview instead of a redundant tile page.
 */
test.describe('Hub desktop redirect', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test.use({ viewport: { width: 1280, height: 900 } })

  test('desktop hub opens Atelier overview', async ({ page }) => {
    await page.goto('/hub')
    await expect(page).toHaveURL(/\/atelier\?tab=overview/, { timeout: 45_000 })
  })
})
