import { test, expect } from '@playwright/test'

/**
 * Old System / Studio Bible links keep landing somewhere useful (Aide batch 6, 2026-11-18: the Studio Bible, its
 * Kaizen → Système regenerate tool and the ledger reference copy are gone).
 * Requires an authenticated session for `/atelier` (Supabase middleware).
 * Run locally: `ATELIER_E2E=1 npm run dev` then `ATELIER_E2E=1 npm run test:e2e`
 */
test.describe('Old System / Studio Bible links', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('/atelier/system opens Kaizen', async ({ page }) => {
    await page.goto('/atelier/system', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/atelier\/kaizen/, { timeout: 45_000 })
  })

  test('/Atelier_Studio_Bible.pdf opens the Aide', async ({ page }) => {
    await page.goto('/Atelier_Studio_Bible.pdf', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/atelier\/aide/, { timeout: 45_000 })
  })
})
