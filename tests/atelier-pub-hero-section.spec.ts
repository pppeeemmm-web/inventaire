import { test, expect } from '@playwright/test'

/**
 * Requires an authenticated session for `/atelier` (Supabase middleware).
 * Run locally: `ATELIER_E2E=1 npm run dev` then `ATELIER_E2E=1 npm run test:e2e`
 */
test.describe('Atelier Public tab — hero editor', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('Site public tab exposes hero section and HTTPS URL field', async ({ page }) => {
    await page.goto('/atelier/portfolio', { waitUntil: 'domcontentloaded' })
    const hero = page.getByTestId('atelier-pub-hero-section')
    await expect(hero).toBeVisible({ timeout: 45_000 })
    await expect(hero.locator('input[type="url"]')).toBeVisible()
  })
})

