import { test, expect } from '@playwright/test'

/**
 * Broadcast-ready gate (`data-testid="wf-broadcast-ready-switch"`).
 * Requires `/atelier` auth — same pattern as other atelier E2E tests.
 */
test.describe('Work editor broadcast-ready toggle', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('new work form exposes broadcast-ready switch', async ({ page }) => {
    await page.goto('/atelier/works/new')
    await expect(page.getByTestId('wf-broadcast-ready-switch')).toBeVisible({ timeout: 45_000 })
  })
})
