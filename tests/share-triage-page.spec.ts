import { test, expect } from '@playwright/test'

test.describe('Share triage page', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('loads inbox shell when authenticated', async ({ page }) => {
    await page.goto('/atelier/share-triage')
    await expect(page.getByTestId('share-triage-root')).toBeVisible({ timeout: 45_000 })
  })
})
