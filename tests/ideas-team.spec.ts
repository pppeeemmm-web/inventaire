import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * Idées (R1 step 6, slice 4a). The Idées Server Actions are intercepted by id (dev build manifest):
 * the ideas and their discussion lines are fake, and every write (add a line, propose, close,
 * weight / maturity) is only recorded — nothing reaches the database (the dev DB is production).
 * Other Atelier calls pass through (reads only). Which view runs depends on the dev session:
 * a team member's (propose + add a line) or Pem's (admin: close, maturity). Runs against `npm run dev`.
 */
test.describe('Idées (R1 slice 4a)', () => {
  test.skip(!process.env.ATELIER_E2E, 'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.')

  const now = '2026-11-17T09:00:00Z'
  const idea = (id: string, titre: string, extra: Record<string, unknown> = {}) => ({
    id, titre, created_at: now, updated_at: now, description: null, medium: null, themes: null, statut: 'idee',
    oeuvre_id: null, image_note: null, energie: null, notes: null, category: 'artistic',
    weight: 'petite', maturity: 'graine', discussion_closed_at: null, ...extra,
  })
  const IDEAS = [
    idea('e2e-open', 'E2E open idea', { weight: 'recherche', maturity: 'pousse' }),
    idea('e2e-closed', 'E2E closed idea', { discussion_closed_at: now }),
  ]
  const LINES = [
    { id: 1, conceptId: 'e2e-open', body: 'First E2E line', author: 'Test A', createdAt: '2026-11-15T09:00:00Z', discarded: false, mine: false },
    { id: 2, conceptId: 'e2e-open', body: 'Second E2E line', author: 'Test B', createdAt: '2026-11-16T09:00:00Z', discarded: false, mine: false },
    { id: 3, conceptId: 'e2e-closed', body: 'Closed E2E line', author: 'Test A', createdAt: '2026-11-16T09:00:00Z', discarded: false, mine: false },
  ]
  const NEW_LINE = { id: 9, conceptId: 'e2e-open', body: 'My E2E line', author: 'Me', createdAt: now, discarded: false, mine: true }

  const reply = (value: unknown) => `0:{"a":"$@1","f":"","b":"development"}\n1:${JSON.stringify(value)}\n`

  function actionIds(names: string[]): Map<string, string> {
    const raw = decodeURIComponent(fs.readFileSync(path.join(process.cwd(), '.next/server/server-reference-manifest.json'), 'utf8'))
    const ids = new Map<string, string>()
    for (const name of names) {
      const m = raw.match(new RegExp(`"id":"([0-9a-f]+)","exportedName":"${name}"`))
      if (!m) throw new Error(`action ${name} not compiled yet`)
      ids.set(m[1], name)
    }
    return ids
  }

  const READS = ['fetchConcepts', 'fetchIdeaLines']
  // Every write the Idées screen can send: recorded, never passed through.
  const WRITES = ['addIdeaLine', 'proposeIdea', 'setIdeaDiscussionClosed', 'updateConcept', 'createConcept', 'deleteConcept', 'uploadConceptSketch']

  async function mockIdeas(page: Page): Promise<Array<{ name: string; args: unknown[] }>> {
    const sent: Array<{ name: string; args: unknown[] }> = []
    let ids: Map<string, string> | null = null
    await page.route('**/*', async (route: Route) => {
      const req = route.request()
      const id = req.headers()['next-action']
      if (req.method() !== 'POST' || !id) return route.continue()
      ids ??= actionIds([...READS, ...WRITES])
      const name = ids.get(id)
      if (!name) return route.continue()
      const body = (v: unknown) => route.fulfill({ status: 200, contentType: 'text/x-component', body: reply(v) })
      if (name === 'fetchConcepts') return body(IDEAS)
      if (name === 'fetchIdeaLines') return body(LINES)
      let args: unknown[] = []
      try {
        args = JSON.parse(req.postData() || '[]') as unknown[]
      // eslint-disable-next-line pem-i18n/no-silent-catch -- a FormData body (create / sketch) is recorded as such
      } catch {
        args = ['(form data)']
      }
      sent.push({ name, args })
      if (name === 'addIdeaLine') return body({ ok: true, line: NEW_LINE })
      if (name === 'setIdeaDiscussionClosed') return body({ ok: true, closedAt: args[1] ? now : null })
      return body({ ok: true })
    })
    return sent
  }

  async function open(page: Page) {
    await page.goto('/atelier/concepts')
    await expect(page.getByText('E2E open idea')).toBeVisible({ timeout: 60_000 })
  }

  async function isAdmin(page: Page) {
    return (await page.getByTestId('idea-team-entry').count()) === 0
  }

  for (const vp of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
    test(`weight, maturity and lines show; no sideways scroll (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize(vp)
      await mockIdeas(page)
      await open(page)
      await expect(page.getByTestId('idea-maturity-mark')).toHaveCount(2)
      const first = page.locator('[data-testid=concepts-tab-root]').getByText('E2E open idea')
      await expect(page.getByTestId('idea-weight').first()).toHaveText(/Recherche|Research/)
      await expect(page.getByTestId('idea-lines-count').first()).toHaveText(/2 (lignes|lines)/)
      await first.click()
      const lines = page.getByTestId('idea-line')
      await expect(lines).toHaveCount(2)
      // Oldest first, author + date.
      await expect(lines.nth(0)).toContainText('First E2E line')
      await expect(lines.nth(0)).toContainText('Test A')
      await expect(lines.nth(1)).toContainText('Second E2E line')
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(scroll).toBeLessThanOrEqual(0)
    })
  }

  test('team: add a line and « Proposer une idée » send only mocked calls; closed discussion has no input', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const sent = await mockIdeas(page)
    await open(page)
    test.skip(await isAdmin(page), 'Dev session is admin: the team view does not show.')

    await expect(page.getByRole('button', { name: /Nouvelle idée|New idea/ })).toHaveCount(0)
    await page.locator('[data-testid=concepts-tab-root]').getByText('E2E open idea').click()
    await expect(page.getByTestId('idea-quickset')).toHaveCount(0)
    await page.getByTestId('idea-line-input').fill('My E2E line')
    await page.getByTestId('idea-line-add').click()
    await expect(page.getByTestId('idea-line')).toHaveCount(3)
    await expect(page.getByTestId('idea-line').nth(2)).toContainText('My E2E line')
    expect(sent[0]).toEqual({ name: 'addIdeaLine', args: ['e2e-open', 'My E2E line'] })

    await page.locator('[data-testid=concepts-tab-root]').getByText('E2E closed idea').click()
    await expect(page.getByTestId('idea-discussion-closed')).toBeVisible()
    await expect(page.getByTestId('idea-discussion-toggle')).toHaveCount(0)

    await page.getByTestId('idea-propose-open').click()
    const send = page.getByTestId('idea-propose-send')
    await expect(send).toBeDisabled()
    await page.getByTestId('idea-propose-body').fill('E2E proposal')
    await page.getByTestId('idea-propose-work').fill('#2233')
    const box = await send.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    await send.click()
    await expect(page.getByTestId('idea-propose-open')).toBeVisible()
    expect(sent[1]).toEqual({ name: 'proposeIdea', args: ['E2E proposal', '#2233'] })
    expect(sent.map((s) => s.name)).toEqual(['addIdeaLine', 'proposeIdea'])
  })

  test('admin: maturity quick-set and closing the discussion send only mocked calls', async ({ page }) => {
    const sent = await mockIdeas(page)
    await open(page)
    test.skip(!(await isAdmin(page)), 'Dev session is a team member: the admin view does not show.')

    await page.locator('[data-testid=concepts-tab-root]').getByText('E2E open idea').click()
    await page.getByTestId('idea-quickset').getByRole('button', { name: /Mûre|Ripe/ }).click()
    await expect.poll(() => sent.length).toBe(1)
    expect(sent[0]).toEqual({ name: 'updateConcept', args: ['e2e-open', { maturity: 'mure' }] })
    await page.getByTestId('idea-discussion-toggle').click()
    await expect(page.getByTestId('idea-discussion-closed')).toBeVisible()
    expect(sent[1]).toEqual({ name: 'setIdeaDiscussionClosed', args: ['e2e-open', true] })
  })
})
