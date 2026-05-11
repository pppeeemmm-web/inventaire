import { test, expect } from '@playwright/test'

test.describe('Enquiry page narrow viewport', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('scroll shell allows vertical overflow with body locked', async ({ page }) => {
    await page.goto('/enquiry')
    const shell = page.getByTestId('enquiry-scroll')
    await expect(shell).toBeVisible()
    const overflowY = await shell.evaluate((el) => getComputedStyle(el).overflowY)
    expect(overflowY).toBe('auto')
    const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow)
    expect(bodyOverflow).toBe('hidden')
  })
})
