import { test, expect } from '@playwright/test'

test.describe('Landing page narrow viewport', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('sticky bottom toolbar with safe-area actions', async ({ page }) => {
    await page.goto('/')
    const toolbar = page.getByTestId('landing-mobile-toolbar')
    await expect(toolbar).toBeVisible()
    const pdfBtn = toolbar.getByRole('button', {
      name: /download portfolio pdf|télécharger le portfolio pdf/i,
    })
    await expect(pdfBtn).toBeVisible()
    const box = await pdfBtn.boundingBox()
    expect(box).not.toBeNull()
    if (box) expect(box.height).toBeGreaterThanOrEqual(44)
    await expect(toolbar.getByRole('link', { name: /hub|atelier/i })).toBeVisible()
  })

  test('menu opens site navigation drawer', async ({ page }) => {
    await page.goto('/')
    const toolbar = page.getByTestId('landing-mobile-toolbar')
    await expect(toolbar).toBeVisible()
    await toolbar.getByRole('button', { name: /open site menu|ouvrir le menu/i }).click()
    await expect(page.getByRole('navigation', { name: /site navigation|navigation du site/i })).toBeVisible()
    await expect(page.locator('#landing-site-nav a[href="/works"]')).toBeVisible()
    await page.getByRole('button', { name: /close|fermer/i }).click()
    await expect(page.getByRole('navigation', { name: /site navigation|navigation du site/i })).not.toBeVisible()
  })
})
