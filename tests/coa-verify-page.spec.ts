import { test, expect } from '@playwright/test'

test.describe('COA verify page', () => {
  test('invalid cert id shows not found or invalid message', async ({ page }) => {
    await page.goto('/verify/NOT-A-CERT-ID')
    await expect(page.getByText(/non reconnu|not valid|invalid/i).first()).toBeVisible({ timeout: 15_000 })
  })

  test('malformed PEM id shows invalid', async ({ page }) => {
    await page.goto('/verify/PEM-bad-nanoid')
    await expect(page.getByText(/non reconnu|not valid|invalid/i).first()).toBeVisible({ timeout: 15_000 })
  })
})
