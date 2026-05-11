import { test, expect } from '@playwright/test'

test.describe('Landing page narrow viewport', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('menu opens site navigation drawer', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /site navigation menu|navigation du site/i }).click()
    await expect(page.getByRole('navigation', { name: /site navigation|navigation du site/i })).toBeVisible()
    await expect(page.locator('#landing-site-nav a[href="/works"]')).toBeVisible()
    await page.getByRole('button', { name: /close|fermer/i }).click()
    await expect(page.getByRole('navigation', { name: /site navigation|navigation du site/i })).not.toBeVisible()
  })
})
