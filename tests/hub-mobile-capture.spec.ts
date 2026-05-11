import { test, expect } from '@playwright/test'

/**
 * Hub compact layout (≤767px): capture tiles deep-link into Atelier.
 * Requires authenticated session — same as other ATELIER_E2E tests.
 */
test.describe('Hub mobile capture tiles', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test.use({ viewport: { width: 375, height: 812 } })

  test('tiles open new work, pipeline, and concepts on small viewport', async ({ page }) => {
    await page.goto('/hub')
    await expect(page.getByTestId('hub-tile-atelier')).toBeVisible({ timeout: 45_000 })

    await page.getByTestId('hub-tile-new-work').click()
    await expect(page).toHaveURL(/\/atelier\/works\/new/)

    await page.goto('/hub')
    await expect(page.getByTestId('hub-tile-pipeline')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('hub-tile-pipeline').click()
    await expect(page).toHaveURL(/[?&]tab=pipeline/)

    await page.goto('/hub')
    await page.getByTestId('hub-tile-concepts').click()
    await expect(page).toHaveURL(/[?&]tab=concepts/)
    await expect(page.getByTestId('concepts-tab-root')).toBeVisible({ timeout: 30_000 })
  })

  test('concepts tab fits viewport width without horizontal overflow', async ({ page }) => {
    await page.goto('/atelier?tab=concepts')
    const root = page.getByTestId('concepts-tab-root')
    await expect(root).toBeVisible({ timeout: 45_000 })
    const { scrollWidth, clientWidth } = await root.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('contacts tab shows quick add panel on narrow viewport', async ({ page }) => {
    await page.goto('/atelier?tab=contacts')
    await expect(page.getByTestId('contacts-quick-add')).toBeVisible({ timeout: 45_000 })
  })

  test('new work page fits viewport width without horizontal overflow', async ({ page }) => {
    await page.goto('/hub')
    await expect(page.getByTestId('hub-tile-new-work')).toBeVisible({ timeout: 45_000 })
    await page.getByTestId('hub-tile-new-work').click()
    await expect(page).toHaveURL(/\/atelier\/works\/new/)
    const root = page.getByTestId('work-form-root')
    await expect(root).toBeVisible({ timeout: 45_000 })
    const { scrollWidth, clientWidth } = await root.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('scan tile opens atelier scan route', async ({ page }) => {
    await page.goto('/hub')
    await expect(page.getByTestId('hub-tile-scan')).toBeVisible({ timeout: 45_000 })
    await page.getByTestId('hub-tile-scan').click()
    await expect(page).toHaveURL(/\/atelier\/scan/)
    await expect(page.getByTestId('atelier-scan-root')).toBeVisible({ timeout: 30_000 })
  })
})
