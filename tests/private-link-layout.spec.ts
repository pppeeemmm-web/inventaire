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
  <div class="ck-root">
    <div class="ck-wrap">
      <div class="ck-works">
        <div class="ck-work">
          <div class="ck-img-ph"></div>
          <div class="ck-meta">
            <div style="min-width:280px">Titre exemple — métadonnées</div>
          </div>
        </div>
      </div>
    </div>
    <div class="ck-bar"><div class="ck-bar-in"><a class="ck-btn ck-btn--ghost">PDF</a><a class="ck-btn ck-btn--fill">Écrire</a></div></div>
  </div>
</body>
</html>`
}

test.describe('Collector kit page layout CSS', () => {
  test('single column at 375px — no horizontal overflow', async ({ page }) => {
    await page.setContent(fixtureHtml())
    await page.setViewportSize({ width: 375, height: 667 })
    const noOverflow = await page.evaluate(() => {
      const root = document.querySelector('.ck-root')
      if (!root) return false
      return root.scrollWidth <= root.clientWidth + 2 && document.documentElement.scrollWidth <= 375
    })
    expect(noOverflow).toBe(true)
    const display = await page.$eval('.ck-work', (el) => getComputedStyle(el).display)
    expect(display).toBe('flex')
    const tapH = await page.$eval('.ck-bar .ck-btn', (el) => el.getBoundingClientRect().height)
    expect(tapH).toBeGreaterThanOrEqual(44)
  })

  test('two columns at 900px', async ({ page }) => {
    await page.setContent(fixtureHtml())
    await page.setViewportSize({ width: 900, height: 700 })
    const cols = await page.$eval('.ck-work', (el) => getComputedStyle(el).gridTemplateColumns)
    const parts = cols.split(' ').filter(Boolean)
    expect(parts.length).toBeGreaterThanOrEqual(2)
  })
})
