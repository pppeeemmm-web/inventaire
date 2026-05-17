import { test, expect } from '@playwright/test'

/**
 * Verb 2 — voice note sheet + Notes tab (auth-gated; requires `voice_note` migration in Supabase).
 */
test.describe('Voice notes (Verb 2)', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test.use({ viewport: { width: 375, height: 812 } })

  test('hub field launcher opens voice sheet', async ({ page }) => {
    await page.goto('/hub')
    await page.getByTestId('hub-field-verb-note').click({ timeout: 45_000 })
    await expect(page.getByTestId('ring-b-voice-sheet')).toBeVisible()
    await expect(page.getByTestId('ring-b-voice-record-toggle')).toBeVisible()
    await expect(page.getByText(/Demain|Tomorrow/)).toBeVisible()
  })

  test('atelier notes tab loads shell', async ({ page }) => {
    await page.goto('/atelier?tab=notes')
    await expect(page.getByTestId('notes-tab-root')).toBeVisible({ timeout: 45_000 })
  })
})
