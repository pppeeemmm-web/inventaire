import { test, expect } from '@playwright/test'

/**
 * Requires an authenticated session for `/atelier` (Supabase middleware).
 * Run locally: `ATELIER_E2E=1 npm run dev` then `ATELIER_E2E=1 npm run test:e2e`
 */
test.describe('Atelier narrow nav — field group first', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('sidebar lists Field / Terrain before Management labels', async ({ page }) => {
    await page.goto('/atelier', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /open navigation|ouvrir le menu/i }).click()
    const nav = page.getByTestId('atelier-nav-groups')
    await expect(nav).toBeVisible({ timeout: 45_000 })
    await expect(nav.locator('.t-eyebrow').first()).toHaveText(/Field|Terrain/)
    await expect(nav.getByRole('button', { name: /Inventory|Inventaire/i }).first()).toBeVisible()
  })
})
