import { test, expect } from '@playwright/test'

/**
 * When the DB has more œuvres than the first keyset page, a paging bar appears.
 * Requires authenticated `/atelier` session.
 */
test.describe('Atelier œuvres paging bar', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('load-more control is present when paging bar is shown', async ({ page }) => {
    await page.goto('/atelier', { waitUntil: 'domcontentloaded' })
    const bar = page.getByTestId('atelier-oeuvres-paging-bar')
    try {
      await bar.waitFor({ state: 'visible', timeout: 20_000 })
    } catch {
      test.skip(true, 'No partial oeuvres load in this environment (≤ first page).')
    }
    await expect(bar.getByRole('button', { name: /Load next batch|Charger la tranche suivante/i })).toBeVisible()

    const subsetBanner = page.getByTestId('atelier-oeuvres-subset-banner')
    await expect(subsetBanner).toBeVisible()
    await expect(
      subsetBanner.getByRole('button', { name: /Load next batch|Charger la tranche suivante/i }),
    ).toBeVisible()
  })
})
