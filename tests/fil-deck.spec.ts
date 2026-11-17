import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * The Fil on the phone (R1 step 6, /hub/fil). Every Server Action call is intercepted: the list call
 * gets fake items, decide calls are only recorded — nothing reaches the database (the dev DB is
 * production). Needs an admin session (dev auto-login with Pem's account) and `npm run dev`
 * (the fake reply carries the dev build id, as in triage-swipe-deck.spec.ts).
 */
test.describe('Fil deck (R1 step 6)', () => {
  test.skip(!process.env.ATELIER_E2E, 'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.')

  test.use({ viewport: { width: 375, height: 812 } })

  const recent = new Date(Date.now() - 2 * 86_400_000).toISOString()
  const old = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const base = { title: null, body: '', work: null, flagged: false, cooled: false }
  // In listFil's order: flagged first, then newest.
  const FAKE = [
    { ...base, key: 'idea:e2e-2', kind: 'idea', id: 'e2e-2', section: 'creation', author: 'Test B', at: recent, title: 'E2E idea', body: 'Last line', newLines: 3, flagged: true },
    { ...base, key: 'note_line:e2e-1', kind: 'note_line', id: 'e2e-1', section: 'creation', author: 'Test A', at: recent, body: 'E2E line on a work', work: { id: 2233, title: 'E2E work', thumb: null }, lineKind: 'work' },
    { ...base, key: 'pending_change:e2e-3', kind: 'pending_change', id: 'e2e-3', section: 'fiches', author: 'Test A', at: recent, work: { id: 1316, title: 'E2E fiche', thumb: null }, changes: [{ key: 'titre', before: 'Old', after: 'New' }], changeKind: 'edit' },
    { ...base, key: 'kaizen_item:e2e-4', kind: 'kaizen_item', id: 'e2e-4', section: 'kaizen', author: 'Test C', at: recent, title: 'E2E kaizen', body: 'Fix the printer' },
    { ...base, key: 'kaizen_item:e2e-5', kind: 'kaizen_item', id: 'e2e-5', section: 'kaizen', author: 'Test C', at: old, title: 'E2E cooled kaizen', cooled: true },
  ]

  const reply = (value: unknown) => `0:{"a":"$@1","f":"","b":"development"}\n1:${JSON.stringify(value)}\n`

  async function mockFil(page: Page): Promise<string[][]> {
    const decided: string[][] = []
    await page.route('**/*', async (route: Route) => {
      const req = route.request()
      if (req.method() !== 'POST' || !req.headers()['next-action']) return route.continue()
      const args = JSON.parse(req.postData() || '[]') as string[]
      if (args.length === 0) return route.fulfill({ status: 200, contentType: 'text/x-component', body: reply({ items: FAKE }) })
      decided.push(args)
      return route.fulfill({ status: 200, contentType: 'text/x-component', body: reply({ ok: true }) })
    })
    return decided
  }

  test('tabs, counts, cards and the cooled fold', async ({ page }) => {
    await mockFil(page)
    await page.goto('/hub/fil')
    await expect(page.getByTestId('hub-fil-tab-creation-count')).toHaveText('2', { timeout: 45_000 })
    await expect(page.getByTestId('hub-fil-tab-fiches-count')).toHaveText('1')
    await expect(page.getByTestId('hub-fil-tab-kaizen-count')).toHaveText('1')
    await expect(page.getByTestId('hub-fil-deck-card')).toContainText('E2E idea')
    await expect(page.getByTestId('hub-fil-deck-card')).toContainText(/3 (nouvelles lignes|new lines)/)

    await page.getByTestId('hub-fil-tab-fiches').click()
    await expect(page.getByTestId('hub-fil-deck-card')).toContainText('#1316')
    await expect(page.getByTestId('hub-fil-deck-keep')).toContainText(/Valider|Approve/)
    await expect(page.getByTestId('hub-fil-deck-discard')).toContainText(/Refuser|Reject/)

    await expect(page.getByTestId('hub-fil-cooled')).toContainText('E2E cooled kaizen')
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(scroll).toBeLessThanOrEqual(0)
  })

  test('discard + « Annuler » sends nothing; keep is sent after 6 s and the count drops', async ({ page }) => {
    const decided = await mockFil(page)
    await page.goto('/hub/fil')
    await expect(page.getByTestId('hub-fil-deck-card')).toContainText('E2E idea', { timeout: 45_000 })

    await page.getByTestId('hub-fil-deck-discard').click()
    await expect(page.getByTestId('hub-fil-deck-card')).toContainText('E2E line on a work')
    await expect(page.getByTestId('hub-fil-deck-card')).toContainText(/#2233/)
    await page.getByRole('button', { name: /Annuler|Undo/ }).click()
    await expect(page.getByTestId('hub-fil-deck-card')).toContainText('E2E idea')
    await page.waitForTimeout(6_500)
    expect(decided).toEqual([])

    await page.getByTestId('hub-fil-deck-keep').click()
    await expect.poll(() => decided.length, { timeout: 10_000 }).toBe(1)
    expect(decided[0]).toEqual(['idea', 'e2e-2', 'keep'])
    await expect(page.getByTestId('hub-fil-tab-creation-count')).toHaveText('1')
  })

  test('switching tab sends the waiting decision at once', async ({ page }) => {
    const decided = await mockFil(page)
    await page.goto('/hub/fil')
    await page.getByTestId('hub-fil-tab-kaizen').click({ timeout: 45_000 })
    await expect(page.getByTestId('hub-fil-deck-card')).toContainText('E2E kaizen')
    await page.keyboard.press('ArrowLeft')
    await page.getByTestId('hub-fil-tab-creation').click()
    await expect.poll(() => decided.length, { timeout: 10_000 }).toBe(1)
    expect(decided[0]).toEqual(['kaizen_item', 'e2e-4', 'discard'])
  })
})
