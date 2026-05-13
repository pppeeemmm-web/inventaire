import { test, expect } from '@playwright/test'

/**
 * Overview bootstrap: expense + pipeline + calendar data is RSC-fed (no client Supabase for pulse).
 * Requires authenticated `/atelier` session.
 */
test.describe('Atelier overview bootstrap', () => {
  test.skip(!process.env.ATELIER_E2E, 'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.')

  test('overview tab shows executive summary after load', async ({ page }) => {
    await page.goto('/atelier', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('atelier-overview-executive')).toBeVisible({ timeout: 25_000 })
  })
})
