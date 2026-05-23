import { test, expect } from '@playwright/test'

/**
 * Atelier > Admin > Audit (`/atelier/audit`).
 * Requires `/atelier` auth — same pattern as other atelier E2E tests.
 */
test.describe('Audit tab', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('deep link loads panel: ledger and pending subtabs', async ({ page }) => {
    await page.goto('/atelier/audit')
    await expect(page.getByTestId('audit-tab-root')).toBeVisible({ timeout: 45_000 })

    const ledgerSub = page.getByTestId('audit-subtab-ledger')
    const pendingSub = page.getByTestId('audit-subtab-pending')
    await expect(ledgerSub).toBeVisible({ timeout: 20_000 })
    await expect(pendingSub).toBeVisible()

    await pendingSub.click()
    await expect(page.getByTestId('audit-tab-root')).toBeVisible()
    await ledgerSub.click()
    await expect(ledgerSub).toBeVisible()
  })

  test('legacy ?tab=audit redirects to segment route', async ({ page }) => {
    await page.goto('/atelier?tab=audit')
    await expect(page).toHaveURL(/\/atelier\/audit/, { timeout: 45_000 })
    await expect(page.getByTestId('audit-tab-root')).toBeVisible({ timeout: 20_000 })
  })
})
