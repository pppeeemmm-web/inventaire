import { test, expect } from '@playwright/test'

/**
 * Verb 1 — /atelier/session/new field capture flow (auth-gated).
 */
test.describe('Work session (Verb 1)', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test.use({ viewport: { width: 375, height: 812 } })

  test('session new page shows root shell', async ({ page }) => {
    await page.goto('/atelier/session/new')
    await expect(page.getByTestId('session-new-root')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByTestId('session-date-input')).toBeVisible()
    await expect(page.getByTestId('session-field-context-capture')).toBeVisible()
    await page.getByTestId('session-add-painting').click()
    await expect(page.getByTestId('session-active-item')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('session-work-mode-existing')).toBeVisible()
    await expect(page.getByTestId('session-work-mode-new')).toBeVisible()
    await expect(page.getByTestId('session-item-tab-1')).toBeVisible()
    await expect(page.getByTestId('session-work-search-input')).toBeVisible()
    await expect(page.getByTestId('field-hub-back')).toBeVisible()
    await expect(page.getByTestId('session-photo-capture')).toBeVisible()
    await expect(page.getByTestId('session-photo-take')).toBeVisible()
    await expect(page.getByTestId('session-photo-library')).toBeVisible()
  })
})
