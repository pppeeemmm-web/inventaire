import { test, expect } from '@playwright/test'

/**
 * Atelier undo + actionable toasts (selection, soft-delete restore, save revert).
 * Requires `ATELIER_E2E=1` and a logged-in session (see `tests/inventory-virtual.spec.ts`).
 */
test.describe('Atelier global undo', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('inventory shows select-all control for undo smoke', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pem_team_tab', 'inventory')
    })
    await page.goto('/atelier')
    await expect(page.getByRole('button', { name: /Tout sélectionner|Select all/i })).toBeVisible({
      timeout: 45_000,
    })
  })
})
