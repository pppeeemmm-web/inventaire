import { test, expect } from '@playwright/test'

test.describe('Session journal tab', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('desktop journal opens on the stream', async ({ page }) => {
    await page.goto('/atelier/journal')
    await expect(page.getByTestId('journal-desk')).toBeVisible({ timeout: 45_000 })
  })

  test('desktop journal ?stream=0 renders the dated session surface', async ({ page }) => {
    await page.goto('/atelier/journal?stream=0')
    await expect(page.getByTestId('session-journal-tab')).toBeVisible({ timeout: 45_000 })
  })
})

