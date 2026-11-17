import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * Audit « Retirés du Fil » (R1 step 6). Only `listFilLog` and `recallFil` are intercepted, by their
 * Server Action ids read from the dev build's manifest; every other Atelier call passes through
 * (reads only). Nothing is recalled in the database. Runs against `npm run dev`.
 */
test.describe('Audit Fil log (R1 step 6)', () => {
  test.skip(!process.env.ATELIER_E2E, 'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.')

  test.use({ viewport: { width: 1280, height: 800 } })

  const FAKE = [
    { kind: 'kaizen_item', id: 'e2e-1', at: '2026-11-16T10:00:00Z', recalledAt: null, label: 'E2E kaizen discarded', recallable: true },
    { kind: 'pending_change', id: 'e2e-2', at: '2026-11-15T10:00:00Z', recalledAt: null, label: '#1316', recallable: false },
    { kind: 'note_line', id: 'e2e-3', at: '2026-11-14T10:00:00Z', recalledAt: '2026-11-15T09:00:00Z', label: '#2233 · E2E line', recallable: true },
  ]

  const reply = (value: unknown) => `0:{"a":"$@1","f":"","b":"development"}\n1:${JSON.stringify(value)}\n`

  /** Server Action id of an export of app/atelier/fil/actions.ts, from the dev manifest. */
  function actionId(name: string): string {
    const raw = decodeURIComponent(fs.readFileSync(path.join(process.cwd(), '.next/server/server-reference-manifest.json'), 'utf8'))
    const m = raw.match(new RegExp(`"id":"([0-9a-f]+)","exportedName":"${name}"`))
    if (!m) throw new Error(`action ${name} not compiled yet`)
    return m[1]
  }

  async function mockLog(page: Page): Promise<string[][]> {
    const recalled: string[][] = []
    let ids: { list: string; recall: string } | null = null
    await page.route('**/*', async (route: Route) => {
      const req = route.request()
      const id = req.headers()['next-action']
      if (req.method() !== 'POST' || !id) return route.continue()
      ids ??= { list: actionId('listFilLog'), recall: actionId('recallFil') }
      if (id === ids.list) return route.fulfill({ status: 200, contentType: 'text/x-component', body: reply({ entries: FAKE }) })
      if (id === ids.recall) {
        recalled.push(JSON.parse(req.postData() || '[]') as string[])
        return route.fulfill({ status: 200, contentType: 'text/x-component', body: reply({ ok: true }) })
      }
      return route.continue()
    })
    return recalled
  }

  test('lists discards; « Rappeler » sends the recall; recalled and image rows have no button', async ({ page }) => {
    const recalled = await mockLog(page)
    await page.goto('/atelier/audit')
    await page.getByTestId('audit-subtab-fil').click({ timeout: 60_000 })
    await expect(page.getByTestId('audit-fil-log')).toContainText('E2E kaizen discarded')
    await expect(page.getByTestId('audit-fil-log-row-note_line:e2e-3')).toContainText(/Rappelé|Recalled/)
    await expect(page.getByTestId('audit-fil-log-row-pending_change:e2e-2')).toContainText(/Image refusée|Rejected image/)
    await expect(page.getByTestId('audit-fil-log-recall-note_line:e2e-3')).toHaveCount(0)

    await page.getByTestId('audit-fil-log-recall-kaizen_item:e2e-1').click()
    await expect.poll(() => recalled.length, { timeout: 10_000 }).toBe(1)
    expect(recalled[0]).toEqual(['kaizen_item', 'e2e-1'])
  })
})
