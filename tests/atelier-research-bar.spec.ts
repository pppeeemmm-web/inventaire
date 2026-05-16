import { test, expect } from '@playwright/test'

test.describe('Atelier research bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/atelier', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('atelier-research-pill')).toBeVisible({ timeout: 45_000 })
  })

  test('opens search and jumps to reports', async ({ page }) => {
    await page.getByTestId('atelier-research-pill').click()
    await expect(page.getByTestId('atelier-research-panel')).toBeVisible()
    await page.getByRole('searchbox').fill('rep')
    await page.getByTestId('atelier-research-result').filter({ hasText: /Rapports|Reports/ }).first().click()
    await expect(page.getByTestId('reports-root')).toBeVisible({ timeout: 20_000 })
  })

  test('quick reports action opens reports', async ({ page }) => {
    await page.getByTestId('atelier-research-pill').click()
    await page.getByRole('button', { name: /^Rapports|^Reports/ }).first().click()
    await expect(page.getByTestId('reports-root')).toBeVisible({ timeout: 20_000 })
  })
})

test.describe('Atelier research bar mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('uses a compact pill and keeps the viewport within 375px', async ({ page }) => {
    await page.goto('/atelier', { waitUntil: 'domcontentloaded' })
    const pill = page.getByTestId('atelier-research-pill')
    await expect(pill).toBeVisible({ timeout: 45_000 })
    await expect(pill).toHaveCSS('border-radius', /999px|50%/)

    await pill.click()
    await expect(page.getByTestId('atelier-research-panel')).toBeVisible()
    await page.getByRole('searchbox').fill('rep')

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
