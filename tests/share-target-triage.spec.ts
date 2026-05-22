import { test, expect } from '@playwright/test'

test.describe('Share target → new work (Slice 2)', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('works/new accepts shareInbox query and renders WorkForm', async ({ page }) => {
    await page.goto('/atelier/works/new?shareInbox=00000000-0000-0000-0000-000000000099')
    await expect(page.getByTestId('work-form-root')).toBeVisible({ timeout: 45_000 })
  })

  test('share triage shows new-work actions when inbox detail is open', async ({ page }) => {
    await page.goto('/atelier/share-triage')
    await expect(page.getByTestId('share-triage-root')).toBeVisible({ timeout: 45_000 })
    const recentLink = page.locator('a[href*="share-triage?inbox="]').first()
    const hasRecent = await recentLink.isVisible().catch(() => false)
    if (!hasRecent) {
      test.skip(true, 'No share_inbox rows in dev DB — import via share target first')
    }
    await recentLink.click()
    await expect(page.getByTestId('share-triage-new-work')).toBeVisible({ timeout: 20_000 })
  })

  test('hub field launcher includes From Lightroom row', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/hub')
    await expect(page.getByTestId('hub-field-verb-lightroom')).toBeVisible({ timeout: 45_000 })
  })
})
