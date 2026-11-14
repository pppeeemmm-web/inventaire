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

  test('journal day opens voice sheet', async ({ page }) => {
    await page.goto('/atelier/journal?today=1')
    await page.getByTestId('journal-quick-voice').click({ timeout: 45_000 })
    const sheet = page.getByTestId('ring-b-voice-sheet')
    await expect(sheet).toBeVisible()
    // Record first: the sheet opens on the recorder, or on the mic-blocked panel when the
    // browser has no microphone / refuses it (headless). Never on a form to fill first.
    await expect(sheet).toHaveAttribute('data-phase', /starting|recording|blocked/)
    if ((await sheet.getAttribute('data-phase')) === 'recording') {
      await expect(page.getByTestId('ring-b-voice-record-toggle')).toBeVisible()
      await page.getByTestId('ring-b-voice-cancel').click()
      return
    }
    await expect(page.getByTestId('ring-b-voice-blocked')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('ring-b-voice-write').click()
    await expect(page.getByText(/Demain|Tomorrow/)).toBeVisible()
  })

  test('atelier notes tab loads shell', async ({ page }) => {
    await page.goto('/atelier/notes')
    await expect(page.getByTestId('notes-tab-root')).toBeVisible({ timeout: 45_000 })
  })
})
