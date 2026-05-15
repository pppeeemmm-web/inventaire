import { test, expect } from '@playwright/test'

test.describe('Business card capture', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test.use({ viewport: { width: 375, height: 812 } })

  test('card capture page loads and analyzes pasted text', async ({ page }) => {
    await page.goto('/atelier/capture?mode=card')
    await expect(page.getByTestId('capture-card-root')).toBeVisible({ timeout: 45_000 })

    const sample = 'Jane Doe\nGallery Example\njane@example.com\n+33 1 23 45 67 89'
    await page.getByLabel(/nom|name/i).fill(sample)
    await page.getByTestId('capture-card-analyze').click()
    await expect(page.getByTestId('capture-card-preview')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('capture-card-create')).toBeVisible()
  })
})
