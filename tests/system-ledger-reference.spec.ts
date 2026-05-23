import { test, expect } from '@playwright/test'

/**
 * Requires an authenticated session for `/atelier` (Supabase middleware).
 * Run locally: `ATELIER_E2E=1 npm run dev` then `ATELIER_E2E=1 npm run test:e2e`
 */
test.describe('System tab — ledger reference MD', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('copy and download controls are visible on System tab', async ({ page }) => {
    await page.goto('/atelier/system', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('system-ledger-heading')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByTestId('system-ledger-ref-copy')).toBeVisible()
    await expect(page.getByTestId('system-ledger-ref-download')).toBeVisible()
    await expect(page.getByTestId('system-ledger-attach-trigger')).toBeVisible()
  })

  test('copy places markdown in clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/atelier/system', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('system-ledger-heading')).toBeVisible({ timeout: 45_000 })
    await page.getByTestId('system-ledger-ref-copy').click()
    await expect(page.getByRole('status')).toContainText(/clipboard|presse-papiers/i, { timeout: 15_000 })
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip).toContain('# System Ledger')
  })
})

