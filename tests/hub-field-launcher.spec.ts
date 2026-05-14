import { test, expect } from '@playwright/test'

/**
 * Ring B.1 — Hub field launcher on narrow viewports.
 * Requires authenticated session — same as other ATELIER_E2E tests.
 */
test.describe('Hub field launcher (Ring B.1)', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test.use({ viewport: { width: 375, height: 812 } })

  test('narrow hub shows eight field verb rows', async ({ page }) => {
    await page.goto('/hub')
    await expect(page.getByTestId('hub-field-launcher-root')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByTestId('hub-field-verb-session')).toBeVisible()
    await expect(page.getByTestId('hub-field-verb-note')).toBeVisible()
    await expect(page.getByTestId('hub-field-verb-scan-doc')).toBeVisible()
    await expect(page.getByTestId('hub-field-verb-pipeline')).toBeVisible()
    await expect(page.getByTestId('hub-field-verb-triage')).toBeVisible()
    await expect(page.getByTestId('hub-field-verb-contact')).toBeVisible()
    await expect(page.getByTestId('hub-field-verb-document')).toBeVisible()
    await expect(page.getByTestId('hub-field-verb-issue')).toBeVisible()
  })

  test('session row navigates to session capture stub', async ({ page }) => {
    await page.goto('/hub')
    await expect(page.getByTestId('hub-field-launcher-root')).toBeVisible({ timeout: 45_000 })
    await page.getByTestId('hub-field-verb-session').click()
    await expect(page).toHaveURL(/\/atelier\/session\/new/)
  })

  test('note row opens voice note sheet', async ({ page }) => {
    await page.goto('/hub')
    await expect(page.getByTestId('hub-field-launcher-root')).toBeVisible({ timeout: 45_000 })
    await page.getByTestId('hub-field-verb-note').click()
    await expect(page.getByTestId('ring-b-voice-sheet')).toBeVisible()
    await page.getByTestId('ring-b-voice-sheet-close').click()
    await expect(page.getByTestId('ring-b-voice-sheet')).not.toBeVisible()
  })

  test('pipeline row opens atelier pipeline tab', async ({ page }) => {
    await page.goto('/hub')
    await expect(page.getByTestId('hub-field-launcher-root')).toBeVisible({ timeout: 45_000 })
    await page.getByTestId('hub-field-verb-pipeline').click()
    await expect(page).toHaveURL(/[?&]tab=pipeline/)
  })

  test('scan doc row opens capture with doc mode', async ({ page }) => {
    await page.goto('/hub')
    await expect(page.getByTestId('hub-field-launcher-root')).toBeVisible({ timeout: 45_000 })
    await page.getByTestId('hub-field-verb-scan-doc').click()
    await expect(page).toHaveURL(/\/atelier\/capture\?.*mode=doc/)
  })
})
