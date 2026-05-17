import { test, expect } from '@playwright/test'

/**
 * Mobile sale flow is auth-gated and records external payments only.
 */
test.describe('Mobile sale flow', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test.use({ viewport: { width: 375, height: 812 } })

  test('sale new page shows phone shell and validates first step', async ({ page }) => {
    await page.goto('/atelier/sale/new')
    await expect(page.getByTestId('mobile-sale-root')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByTestId('field-hub-back')).toBeVisible()
    await page.getByTestId('mobile-sale-next').click()
    await expect(page.getByText(/Complétez cette étape|Complete this step/)).toBeVisible()
  })
})
