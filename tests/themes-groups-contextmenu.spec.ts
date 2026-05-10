import { test, expect } from '@playwright/test'

/** Themes tab rows + constellation toolbar: context-menu rename / ctrl+delete (manual QA hook). */
test.describe('Themes / groups context menu', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('themes tab mounts catalog rows', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pem_team_tab', 'themes')
    })
    await page.goto('/atelier')
    await expect(
      page.getByRole('heading', { name: /^(Thèmes|Themes)$/ }),
    ).toBeVisible({ timeout: 45_000 })
  })
})
