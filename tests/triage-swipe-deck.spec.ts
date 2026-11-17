import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * Shared swipe deck on Hub Triage (R1 + R2 build step 4, components/shared/SwipeDeck.tsx).
 * The deck's Server Action calls are intercepted: the list call gets two fake enquiries, the
 * approve / archive calls are only recorded — nothing reaches the database.
 * The fake action reply follows Next's RSC action format (`0:{…"b":"development"}` = dev build id),
 * so this spec runs against `npm run dev` only.
 */
test.describe('Triage swipe deck (step 4)', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test.use({ viewport: { width: 375, height: 812 } })

  const FAKE = [
    { kind: 'enquiry', id: 'e2e-enquiry-1', name: 'Test One', email: 'one@example.com', message: 'First fake enquiry', category: 'other', createdAt: '2026-11-17T09:00:00Z' },
    { kind: 'enquiry', id: 'e2e-enquiry-2', name: 'Test Two', email: 'two@example.com', message: 'Second fake enquiry', category: 'other', createdAt: '2026-11-17T10:00:00Z' },
  ]

  const reply = (value: unknown) => `0:{"a":"$@1","f":"","b":"development"}\n1:${JSON.stringify(value)}\n`

  async function mockDeck(page: Page): Promise<string[][]> {
    const decided: string[][] = []
    // Every path: after leaving the page, the waiting action is posted to the new page's URL.
    await page.route('**/*', async (route: Route) => {
      const req = route.request()
      if (req.method() !== 'POST' || !req.headers()['next-action']) return route.continue()
      const args = JSON.parse(req.postData() || '[]') as string[]
      if (args.length === 0) {
        return route.fulfill({ status: 200, contentType: 'text/x-component', body: reply({ cards: FAKE }) })
      }
      decided.push(args)
      return route.fulfill({ status: 200, contentType: 'text/x-component', body: reply({ ok: true }) })
    })
    return decided
  }

  test('discard then « Annuler » sends nothing; keep is sent after the undo window', async ({ page }) => {
    const decided = await mockDeck(page)
    await page.goto('/atelier/triage')
    await expect(page.getByTestId('triage-deck-card')).toContainText('Test One', { timeout: 45_000 })

    await page.getByTestId('triage-deck-discard').click()
    await expect(page.getByTestId('triage-deck-card')).toContainText('Test Two')
    await page.getByRole('button', { name: /Annuler|Undo/ }).click()
    await expect(page.getByTestId('triage-deck-card')).toContainText('Test One')
    await page.waitForTimeout(6_500)
    expect(decided).toEqual([])

    await page.getByTestId('triage-deck-keep').click()
    await expect(page.getByTestId('triage-deck-card')).toContainText('Test Two')
    await expect.poll(() => decided.length, { timeout: 10_000 }).toBe(1)
    expect(decided[0]).toEqual(['e2e-enquiry-1'])
  })

  test('a waiting decision is sent when the page is left', async ({ page }) => {
    const decided = await mockDeck(page)
    await page.goto('/atelier/triage')
    await expect(page.getByTestId('triage-deck-card')).toContainText('Test One', { timeout: 45_000 })
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('triage-deck-card')).toContainText('Test Two')
    await page.getByRole('link', { name: /Hub|Retour/i }).last().click()
    await expect.poll(() => decided.length, { timeout: 10_000 }).toBe(1)
    expect(decided[0]).toEqual(['e2e-enquiry-1'])
  })
})
