import { test, expect } from '@playwright/test'

test.describe('Exhibitions tab', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('segment route loads exhibitions panel', async ({ page }) => {
    await page.goto('/atelier/exhibitions')
    await expect(page.getByTestId('exhibitions-root')).toBeVisible({ timeout: 45_000 })
  })

  test('legacy ?tab=exhibitions redirects to segment route', async ({ page }) => {
    await page.goto('/atelier/exhibitions')
    await expect(page).toHaveURL(/\/atelier\/exhibitions(?:\?|$)/, { timeout: 45_000 })
    await expect(page.getByTestId('exhibitions-root')).toBeVisible({ timeout: 45_000 })
  })
})

