import { test, expect } from '@playwright/test'

/**
 * Requires an authenticated session for `/atelier` (Supabase middleware).
 * Run locally: `ATELIER_E2E=1 npm run dev` then `ATELIER_E2E=1 npm run test:e2e`
 */
test.describe('Atelier Stock + Stock-take tabs', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('Stock tab shows toolbar, table, and new-item control', async ({ page }) => {
    await page.goto('/atelier/stock', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('atelier-stock-root')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByTestId('atelier-stock-toolbar')).toBeVisible()
    await expect(page.getByTestId('atelier-stock-table')).toBeVisible()
    await expect(page.getByTestId('atelier-stock-new-item')).toBeVisible()
  })

  test('Stock-take tab shows table and apply entrypoint', async ({ page }) => {
    await page.goto('/atelier/stock-take', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('atelier-stock-take-root')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByTestId('atelier-stock-take-toolbar')).toBeVisible()
    await expect(page.getByTestId('atelier-stock-take-scroll')).toBeVisible()
    const topApply = page.getByTestId('atelier-stock-take-apply-top')
    const stickyApply = page.getByTestId('atelier-stock-take-apply-sticky')
    await expect(topApply.or(stickyApply)).toBeVisible()
  })
})

