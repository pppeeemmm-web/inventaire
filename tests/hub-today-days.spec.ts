import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * R2 « Aujourd'hui »: ‹ › between days (`?day=`), the two folds (closed, read when opened) and the
 * phone Atelier menu top block. Reads only: the fold's Server Action is intercepted and answered
 * with fake rows, so nothing reaches the database (the dev DB is production). Needs `npm run dev`
 * and the dev auto-login (the fake reply carries the dev build id, as in fil-deck.spec.ts).
 */
test.describe('Aujourd’hui — days, folds, phone menu (R2)', () => {
  test.skip(!process.env.ATELIER_E2E, 'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.')

  test.use({ viewport: { width: 375, height: 812 } })

  const reply = (value: unknown) => `0:{"a":"$@1","f":"","b":"development"}\n1:${JSON.stringify(value)}\n`

  /** Every Server Action POST gets the fake folds; the calls are recorded. */
  async function mockActions(page: Page): Promise<unknown[][]> {
    const calls: unknown[][] = []
    await page.route('**/*', async (route: Route) => {
      const req = route.request()
      if (req.method() !== 'POST' || !req.headers()['next-action']) return route.continue()
      calls.push(JSON.parse(req.postData() || '[]') as unknown[])
      const creation = [{ id: -1, created_at: new Date().toISOString(), title: 'E2E création', body: 'Une idée de série', author: 'Test', done: false, works: [2233] }]
      return route.fulfill({ status: 200, contentType: 'text/x-component', body: reply({ isAdmin: false, changes: [], creation }) })
    })
    return calls
  }

  const shift = (day: string, n: number) => {
    const d = new Date(`${day}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().slice(0, 10)
  }

  test('‹ › step a day; no « next » past today; a future day falls back to today', async ({ page }) => {
    await page.goto('/hub')
    const date = page.getByTestId('hub-today-date')
    await expect(date).toBeVisible({ timeout: 45_000 })
    const today = (await date.getAttribute('data-day')) as string
    await expect(page.getByTestId('hub-today-next')).not.toHaveAttribute('href', /.+/)
    await expect(page.getByTestId('hub-field-pulse')).toBeVisible()

    await page.getByTestId('hub-today-prev').click()
    await expect(page).toHaveURL(new RegExp(`\\?day=${shift(today, -1)}$`))
    await expect(date).toHaveAttribute('data-day', shift(today, -1))
    // « À revoir » and the pulse line are today's only.
    await expect(page.getByTestId('hub-field-pulse')).toHaveCount(0)
    await expect(page.getByTestId('hub-today-see-again')).toHaveCount(0)
    // The day screen is the full day (PhoneNav 2026-11-18): no « Ouvrir la journée complète » any more.
    await expect(page.getByRole('link', { name: /Ouvrir la journée complète|Open the full day/ })).toHaveCount(0)

    await page.getByTestId('hub-today-next').click()
    await expect(date).toHaveAttribute('data-day', today)
    await expect(page).toHaveURL(/\/hub$/)

    await page.goto(`/hub/today?day=${shift(today, 3)}`)
    await expect(date).toHaveAttribute('data-day', today, { timeout: 45_000 })

    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(scroll).toBeLessThanOrEqual(0)
  })

  test('folds start closed and read only when opened', async ({ page }) => {
    const calls = await mockActions(page)
    await page.goto('/hub')
    const fold = page.getByTestId('hub-today-fold-creation')
    await expect(fold).toBeVisible({ timeout: 45_000 })
    await expect(fold).not.toHaveAttribute('open', /.*/)
    await page.waitForTimeout(1_000)
    expect(calls).toEqual([])

    await fold.locator('summary').click()
    await expect(fold).toContainText('E2E création')
    await expect(fold).toContainText('#2233')
    expect(calls).toHaveLength(1)
  })

  test('an old shoot day lists the works photographed that day, folded', async ({ page }) => {
    // 23 Sep 2024: photos named W_…_20240923… (read only; the day is in the file names, not in a table).
    await page.goto('/hub?day=2024-09-23')
    const fold = page.getByTestId('hub-today-photographed')
    await expect(fold).toBeVisible({ timeout: 45_000 })
    await expect(fold).not.toHaveAttribute('open', /.*/)
    await expect(fold.locator('summary')).toContainText(/\(\d+\)/)
    await expect(page.getByTestId('hub-today-date')).toHaveText('23/09/2024')
  })

  test('phone menu in the Atelier: the same sheet, Aujourd’hui first, Idées a tile', async ({ page }) => {
    await page.goto('/atelier/journal')
    await page.getByTestId('phone-menu-open').click({ timeout: 45_000 })
    await expect(page.getByTestId('phone-menu-sheet')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByTestId('phone-menu-tile-today')).toContainText(/Aujourd’hui|Today/)
    await expect(page.getByTestId('phone-menu-tile-ideas')).toContainText(/Idées|Ideas/)
    await expect(page.getByTestId('atelier-nav-groups')).toHaveCount(0)
    const box = await page.getByTestId('phone-menu-tile-today').boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  })

  test('a day in the phone Journal opens in the day screen', async ({ page }) => {
    await page.goto('/atelier/journal?day=2024-09-23')
    await expect(page).toHaveURL(/\/hub\?day=2024-09-23/, { timeout: 45_000 })
    await expect(page.getByTestId('hub-today-date')).toHaveText('23/09/2024')
  })
})
