import { test, expect } from '@playwright/test'

/**
 * Atelier > Diffusion > Broadcast (`?tab=broadcast`).
 * Requires `/atelier` auth — same pattern as other atelier E2E tests.
 */
test.describe('Broadcast tab', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('deep link loads team command center or access gate', async ({ page }) => {
    await page.goto('/atelier?tab=broadcast')
    await expect(page.getByTestId('broadcast-tab-root')).toBeVisible({ timeout: 45_000 })

    const accessGate = page.getByTestId('broadcast-tab-admin-only')
    const queueSub = page.getByTestId('broadcast-subtab-queue')
    await expect(accessGate.or(queueSub)).toBeVisible({ timeout: 20_000 })

    if (await accessGate.isVisible().catch(() => false)) {
      await expect(accessGate).toBeVisible()
      return
    }

    await expect(queueSub).toBeVisible()
    await expect(page.getByTestId('broadcast-subtab-posted')).toBeVisible()
    await expect(page.getByTestId('broadcast-subtab-activity')).toBeVisible()
    await expect(page.getByTestId('broadcast-metrics')).toBeVisible()
    await expect(page.getByTestId('broadcast-platform-filter')).toBeVisible()
    await expect(page.getByTestId('broadcast-search')).toBeVisible()
    await expect(page.getByTestId('broadcast-candidates')).toBeVisible()
    await expect(page.getByTestId('broadcast-detail-panel')).toBeVisible()

    const candidate = page.getByTestId('broadcast-candidate-row').first()
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click()
      await expect(page.getByTestId('broadcast-detail-panel')).toBeVisible()
    }

    await page.getByTestId('broadcast-subtab-posted').click()
    const posted = page.getByTestId('broadcast-posted-row').first()
    if (await posted.isVisible().catch(() => false)) {
      await posted.click()
      await expect(page.getByTestId('broadcast-detail-panel')).toBeVisible()
    }

    await page.getByTestId('broadcast-subtab-activity').click()
    await expect(page.getByTestId('broadcast-filter-vip')).toBeVisible()
    await page.getByTestId('broadcast-filter-all').click()
    await page.getByTestId('broadcast-filter-vip').click()
    const event = page.getByTestId('broadcast-event-row').first()
    if (await event.isVisible().catch(() => false)) {
      await event.click()
      await expect(page.getByTestId('broadcast-detail-panel')).toBeVisible()
    }
    await page.getByTestId('broadcast-reload').click()
  })
})
