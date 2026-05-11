import { test, expect } from '@playwright/test'
import { PRIVATE_LINK_SELECTION_CSS } from '../lib/private-link-layout-css'

function fixtureHtml(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      --bg0: #0a0a0b;
      --bd: #2d2d32;
      --tx: #f8f7f3;
      --tx3: #737373;
    }
    body { margin: 0; font-family: system-ui, sans-serif; }
    ${PRIVATE_LINK_SELECTION_CSS}
  </style>
</head>
<body>
  <div class="pl-root">
    <div class="pl-works">
      <div class="pl-row">
        <div class="pl-thumb" style="background:#222;border-radius:2px"></div>
        <div class="pl-meta">
          <div style="min-width:280px">Titre exemple — métadonnées</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`
}

test.describe('Private link layout CSS', () => {
  test('single column at 375px — no horizontal overflow', async ({ page }) => {
    await page.setContent(fixtureHtml())
    await page.setViewportSize({ width: 375, height: 667 })
    const noOverflow = await page.evaluate(() => {
      const root = document.querySelector('.pl-root')
      if (!root) return false
      return root.scrollWidth <= root.clientWidth + 2
    })
    expect(noOverflow).toBe(true)
    const cols = await page.$eval('.pl-row', (el) => getComputedStyle(el).gridTemplateColumns)
    expect(cols.split(' ').length).toBe(1)
  })

  test('two columns at 900px', async ({ page }) => {
    await page.setContent(fixtureHtml())
    await page.setViewportSize({ width: 900, height: 700 })
    const cols = await page.$eval('.pl-row', (el) => getComputedStyle(el).gridTemplateColumns)
    const parts = cols.split(' ').filter(Boolean)
    expect(parts.length).toBeGreaterThanOrEqual(2)
  })
})
