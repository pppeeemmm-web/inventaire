import { test, expect } from '@playwright/test'

/**
 * Requires an authenticated session for `/atelier` (Supabase middleware).
 * Run locally: `ATELIER_E2E=1 npm run dev` (other terminal) then `ATELIER_E2E=1 npm run test:e2e`
 */
test.describe('Inventory virtualization', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('list view exposes virtual scroll region', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pem_team_tab', 'inventory')
    })
    await page.goto('/atelier/inventory')
    await expect(page.getByTestId('inventory-virtual-scroll')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByRole('columnheader', { name: 'État' })).toBeVisible()
  })

  test('grid view opens work drawer rail that fills viewport height', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.addInitScript(() => {
      localStorage.setItem('pem_team_tab', 'inventory')
    })
    await page.goto('/atelier/inventory')
    await expect(page.getByTestId('inventory-virtual-scroll')).toBeVisible({ timeout: 45_000 })
    await page.getByRole('button', { name: '▦' }).click()
    await expect(page.getByTestId('inventory-virtual-grid')).toBeVisible()
    await page.getByTestId('inventory-virtual-grid').getByRole('button').first().click()
    const rail = page.getByTestId('work-drawer-overlay')
    await expect(rail).toBeVisible({ timeout: 15_000 })
    const vh = page.viewportSize()?.height ?? 720
    const railH = await rail.evaluate((el) => el.getBoundingClientRect().height)
    expect(railH).toBeGreaterThanOrEqual(vh * 0.92)
  })
})
