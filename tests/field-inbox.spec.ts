import { test, expect } from '@playwright/test'

/**
 * Field backlog prevention queue (auth-gated).
 */
test.describe('Field inbox', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test.use({ viewport: { width: 375, height: 812 } })

  test('mobile inbox route loads the unified queue shell', async ({ page }) => {
    await page.goto('/atelier/field-inbox')
    await expect(page.getByTestId('field-inbox-root')).toBeVisible({ timeout: 45_000 })
  })
})
