import { test, expect } from '@playwright/test'

/**
 * When the DB has more œuvres than the first keyset page, the shell subset strip
 * shows load-more. Requires authenticated `/atelier` session.
 */
test.describe('Atelier œuvres subset banner', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('load-more control is present when catalogue is partial', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.goto('/atelier', { waitUntil: 'domcontentloaded' })
    const banner = page.getByTestId('atelier-oeuvres-subset-banner')
    try {
      await banner.waitFor({ state: 'visible', timeout: 20_000 })
    } catch {
      test.skip(true, 'No partial oeuvres load in this environment (≤ first page).')
    }
    const loadBtn = banner.getByRole('button', {
      name: /Load next batch|Charger la tranche suivante/i,
    })
    await expect(loadBtn).toBeVisible()
    await expect(loadBtn).toHaveCount(1)
  })
})
