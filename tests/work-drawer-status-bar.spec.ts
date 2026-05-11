import { test, expect } from '@playwright/test'

/**
 * Drawer status bar (`data-testid="work-drawer-status-bar"`). When saved commercial status
 * disagrees with the effective gated status, `data-status-split="true"`.
 */
test.describe('Work drawer commercial vs effective status', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('panel shows status bar when preview is open', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pem_team_tab', 'inventory')
    })
    await page.goto('/atelier')
    await expect(page.getByTestId('inventory-virtual-scroll')).toBeVisible({ timeout: 45_000 })
    await page.getByRole('button', { name: /aperçu/i }).click()
    await expect(page.getByTestId('work-drawer-status-bar')).toBeVisible({ timeout: 15_000 })
  })
})
