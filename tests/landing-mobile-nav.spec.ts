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

  test('enquiry link visible outside hero cluster', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('landing-enquiry-link')).toBeVisible()
  })

  test('hero links to works when works block visible', async ({ page }) => {
    await page.goto('/')
    const heroLink = page.getByRole('link', { name: /view works|voir les œuvres/i })
    if (await heroLink.count() > 0) {
      await expect(heroLink).toHaveAttribute('href', '/works')
    }
  })

  test('menu opens site navigation drawer', async ({ page }) => {
    await page.goto('/')
    const toolbar = page.getByTestId('landing-mobile-toolbar')
    await expect(toolbar).toBeVisible()
    await toolbar.getByRole('button', { name: /open site menu|ouvrir le menu/i }).click()
    await expect(page.getByRole('navigation', { name: /site navigation|navigation du site/i })).toBeVisible()
    await page.getByRole('button', { name: /close|fermer/i }).click()
    await expect(page.getByRole('navigation', { name: /site navigation|navigation du site/i })).not.toBeVisible()
  })
})
