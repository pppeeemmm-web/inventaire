import { test, expect } from '@playwright/test'

/**
 * Hub + atelier narrow flows. Hub uses Ring B.1 field launcher (see hub-field-launcher.spec.ts).
 * Requires authenticated session — same as other ATELIER_E2E tests.
 */
test.describe('Hub mobile + atelier narrow', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test.use({ viewport: { width: 375, height: 812 } })

  test('hub field launcher is visible on small viewport', async ({ page }) => {
    await page.goto('/hub')
    await expect(page.getByTestId('hub-field-launcher-root')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByTestId('hub-field-verb-pipeline')).toBeVisible()
  })

  test('pipeline field row opens pipeline tab', async ({ page }) => {
    await page.goto('/hub')
    await expect(page.getByTestId('hub-field-launcher-root')).toBeVisible({ timeout: 45_000 })
    await page.getByTestId('hub-field-verb-pipeline').click()
    await expect(page).toHaveURL(/\/atelier\/pipeline/)
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
    await page.goto('/atelier/works/new')
    const root = page.getByTestId('work-form-root')
    await expect(root).toBeVisible({ timeout: 45_000 })
    const { scrollWidth, clientWidth } = await root.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('atelier scan route renders on narrow viewport', async ({ page }) => {
    await page.goto('/atelier/scan')
    await expect(page).toHaveURL(/\/atelier\/scan/)
    await expect(page.getByTestId('atelier-scan-root')).toBeVisible({ timeout: 30_000 })
  })
})
