import { test, expect } from '@playwright/test'

/**
 * Desktop sidebar must distribute or scroll within a short viewport (no clipped tabs).
 * Requires ATELIER_E2E=1 and a logged-in atelier session.
 */
test.describe('Atelier sidebar — viewport height', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test('last admin sidebar tab is visible or scrollable at 720px height', async ({ page }) => {
    await page.goto('/atelier/overview', { waitUntil: 'domcontentloaded' })

    const scroll = page.locator('.pem-atelier-sidebar-nav-scroll')
    const nav = page.getByTestId('atelier-nav-groups')
    await expect(nav).toBeVisible({ timeout: 45_000 })

    const audit = nav.getByRole('button', { name: /Audit/i })
    const system = nav.getByRole('button', { name: /Syst[eè]me|System/i })
    const target =
      (await audit.count()) > 0 ? audit.last() : system.last()

    await expect(target).toBeVisible({ timeout: 15_000 })
    await target.scrollIntoViewIfNeeded()
    await expect(target).toBeInViewport({ timeout: 10_000 })

    const metrics = await scroll.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollTop: el.scrollTop,
    }))
    if (metrics.scrollHeight > metrics.clientHeight) {
      await scroll.evaluate((el) => {
        el.scrollTop = el.scrollHeight
      })
      await expect(target).toBeInViewport()
    }
  })
})
