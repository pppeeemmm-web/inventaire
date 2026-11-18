import { test, expect } from '@playwright/test'

/**
 * Ring B.2 — narrow Atelier bottom field bar: the shared `PhoneInputBar` (R2), Écrire · Vocal · Œuvre · Document
 * (hidden when a drawer is open). New work left the bar (Pem 2026-11-14): « Œuvre » is capture or the Journal.
 * Requires authenticated session — same as other ATELIER_E2E tests.
 */
test.describe('Atelier mobile action bar', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test.use({ viewport: { width: 375, height: 812 } })

  test('narrow atelier shows the four-slot field bar, without new work', async ({ page }) => {
    await page.goto('/atelier/inventory', { waitUntil: 'domcontentloaded' })
    const bar = page.getByTestId('phone-input-bar')
    await expect(bar).toBeVisible({ timeout: 45_000 })
    for (const slot of ['phone-bar-write', 'phone-bar-voice', 'phone-bar-work', 'phone-bar-doc']) {
      await expect(bar.getByTestId(slot)).toBeVisible()
    }
    await expect(bar.locator(':scope > *')).toHaveCount(4)
    // « Œuvre » never opens the new-work form (capture for admins, the Journal for the team).
    const work = bar.getByTestId('phone-bar-work')
    if ((await work.evaluate((el) => el.tagName)) === 'A') {
      await expect(work).not.toHaveAttribute('href', /new|nouvelle/i)
    }
  })

  test('narrow atelier header has the « Aujourd’hui » chip', async ({ page }) => {
    await page.goto('/atelier/inventory', { waitUntil: 'domcontentloaded' })
    const hub = page.getByTestId('phone-home-chip')
    await expect(hub).toBeVisible({ timeout: 45_000 })
    await hub.click()
    // Right after first paint the shell's own reads run first in Next's router queue (3–5 s in dev).
    await expect(page).toHaveURL(/\/hub/, { timeout: 45_000 })
  })
})
