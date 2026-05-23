import { test, expect } from '@playwright/test'

/**
 * Requires ATELIER_E2E=1 and a logged-in session (see inventory-virtual.spec.ts).
 */
test.describe('Contacts tab unsaved guard', () => {
  test.skip(!process.env.ATELIER_E2E, 'Set ATELIER_E2E=1 with a logged-in app session.')

  test('switching table row prompts after editing institution (contacts drawer)', async ({ page }) => {
    await page.goto('/atelier/contacts')
    await expect(page.locator('.tbl tbody tr').first()).toBeVisible({ timeout: 45_000 })

    const rows = page.locator('.tbl tbody tr')
    const n = await rows.count()
    test.skip(n < 2, 'Need at least two contacts for this scenario.')

    await rows.nth(0).locator('td').nth(2).click()
    await expect(page.getByTestId('contact-editor-root')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('contact-editor-institution').fill('E2E CONTACT UNSAVED')

    await rows.nth(1).locator('td').nth(2).click()

    await expect(page.getByText(/Modifications non enregistrées|Unsaved changes/)).toBeVisible()
  })
})

