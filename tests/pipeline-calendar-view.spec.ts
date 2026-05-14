import { test, expect } from '@playwright/test'

/**
 * Requires an authenticated session for `/atelier`.
 * Run locally: `ATELIER_E2E=1 npm run dev` then `ATELIER_E2E=1 npm run test:e2e`
 */
test.describe('Pipeline calendar view', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('narrow viewport opens pipeline on calendar by default', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/atelier?tab=pipeline', { waitUntil: 'domcontentloaded' })
    const cal = page.getByRole('button', { name: /Calendar|Calendrier/i })
    await expect(cal).toBeVisible({ timeout: 45_000 })
    await expect(cal).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: /Today|Aujourd/i })).toBeVisible()
  })

  test('Pipeline tab exposes Gantt and Calendar toggles', async ({ page }) => {
    await page.goto('/atelier', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /^Pipeline$/i }).click()
    await expect(page.getByRole('button', { name: /Gantt|gantt/i })).toBeVisible({ timeout: 45_000 })
    await expect(page.getByRole('button', { name: /Calendar|Calendrier/i })).toBeVisible()
    await page.getByRole('button', { name: /Calendar|Calendrier/i }).click()
    await expect(page.getByRole('button', { name: /Today|Aujourd/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Week|Semaine/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Month|Mois/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Quarter|Trimestre/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Semester|Semestre/i })).toBeVisible()
    // Week-number column header: 'W' (en) / 'S' (fr)
    await expect(page.getByLabel(/Week number|Numéro de semaine/i).first()).toBeVisible()
  })

  test('Month grid keeps day columns equal width (Sunday not squeezed)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/atelier', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /^Pipeline$/i }).click()
    await expect(page.getByRole('button', { name: /Calendar|Calendrier/i })).toBeVisible({ timeout: 45_000 })
    await page.getByRole('button', { name: /Calendar|Calendrier/i }).click()
    await page.getByRole('button', { name: /Month|Mois/i }).click()
    const grid = page.getByTestId('pipeline-cal-month-grid')
    await expect(grid).toBeVisible()
    const ratio = await grid.evaluate((el) => {
      const kids = Array.from(el.children) as HTMLElement[]
      if (kids.length < 8) return null
      const mon = kids[1].getBoundingClientRect().width
      const sun = kids[7].getBoundingClientRect().width
      if (mon <= 1) return null
      return { mon, sun, ratio: sun / mon, overflow: el.scrollWidth - el.clientWidth }
    })
    expect(ratio).not.toBeNull()
    if (ratio == null) return
    expect(ratio.overflow).toBeLessThanOrEqual(2)
    expect(ratio.ratio).toBeGreaterThan(0.88)
    expect(ratio.ratio).toBeLessThan(1.12)
  })

  test('Gantt zoom buttons are visible when processes exist', async ({ page }) => {
    await page.goto('/atelier', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /^Pipeline$/i }).click()
    await expect(page.getByRole('button', { name: /Gantt|gantt/i })).toBeVisible({ timeout: 45_000 })
    const zoomIn = page.getByRole('button', { name: /Zoom in|Zoom avant/i })
    if ((await zoomIn.count()) > 0) {
      await expect(zoomIn.first()).toBeVisible()
    }
  })

  test('Gantt view exposes step peek toggle when processes exist', async ({ page }) => {
    await page.goto('/atelier', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /^Pipeline$/i }).click()
    await expect(page.getByRole('button', { name: /Gantt|gantt/i })).toBeVisible({ timeout: 45_000 })
    const peek = page.getByTestId('pipeline-gantt-peek')
    if ((await peek.count()) > 0) {
      await peek.first().click()
      await expect(page.getByTestId('pipeline-gantt-peek-panel').first()).toBeVisible()
    }
  })
})
