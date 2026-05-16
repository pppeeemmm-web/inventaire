import { test, expect } from '@playwright/test'

test.describe('Public SEO shell', () => {
  test('home has a single visible document heading with the artist name', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: /the pem workshop/i })).toBeVisible()
  })

  test('works page exposes exactly one h1 for the document topic', async ({ page }) => {
    await page.goto('/works')
    await expect(page.locator('h1')).toHaveCount(1)
  })
})
