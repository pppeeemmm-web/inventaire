import { test, expect } from '@playwright/test'

test.describe('Document theme on public routes', () => {
  test('pem_theme standard does not apply on home — public stays day (light)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pem_theme', 'standard')
    })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })
})
