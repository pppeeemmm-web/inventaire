import { test, expect } from '@playwright/test'

/** Constellation toolbar: cloud save control mounts when tab is constellation. */
test.describe('Constellation cloud maps', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('constellation tab shows cloud save control', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pem_team_tab', 'constellation')
    })
    await page.goto('/atelier')
    await expect(page.getByTestId('constellation-cloud-save')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByTestId('constellation-tool-rail')).toBeVisible({ timeout: 45_000 })
  })
})
