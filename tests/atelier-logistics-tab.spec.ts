import { test, expect } from '@playwright/test'

/**
 * Requires an authenticated session for `/atelier` (Supabase middleware).
 * Run locally: `ATELIER_E2E=1 npm run dev` then `ATELIER_E2E=1 npm run test:e2e`
 */
test.describe('Atelier Logistics tab', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('Logistics tab shows shell and dictionary-backed copy (FR default)', async ({ page }) => {
    await page.goto('/atelier/logistics', { waitUntil: 'domcontentloaded' })
    const root = page.getByTestId('atelier-logistics-root')
    await expect(root).toBeVisible({ timeout: 45_000 })
    await expect(root.getByText('Logistique', { exact: true })).toBeVisible()
    await expect(
      root.getByText(/mouvements à venir|Aucun mouvement enregistré/),
    ).toBeVisible()
  })
})
