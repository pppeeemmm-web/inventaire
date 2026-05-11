import { test, expect } from '@playwright/test'

test.describe('Login page locale', () => {
  test('FR / EN toggle swaps login copy via dictionary', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pem_lang', 'fr')
    })
    await page.goto('/login')
    await expect(page.getByText('Accès restreint.', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: /^EN$/ }).click()
    await expect(page.getByText('Restricted access.', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: /^FR$/ }).click()
    await expect(page.getByText('Accès restreint.', { exact: true })).toBeVisible()
  })
})
