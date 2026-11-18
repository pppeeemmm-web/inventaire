import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * Voice notes inside the Journal (R1 step 7). `getJournalDayExtras`, `listNoteRouteTargets` and
 * `routeVoiceNote` are intercepted by their Server Action ids (dev manifest): the day gets fake rows and
 * « Relier » calls are only recorded — nothing is written (the dev DB is production). Other reads pass
 * through. Runs against `npm run dev` with a logged-in dev session.
 */
test.describe('Journal voice notes (R1 step 7)', () => {
  test.skip(!process.env.ATELIER_E2E, 'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.')

  const DAY = '2026-11-13'
  const links = { subject: null, oeuvre_id: null, concept_id: null, process_id: null, condition_report_id: null }
  const FAKE_DAY = {
    isAdmin: true,
    entries: [
      {
        id: 990001,
        created_at: `${DAY}T09:00:00Z`,
        event_on: DAY,
        event_precision: 'day',
        kind: 'voice',
        body: 'E2E transcript of a voice note',
        provenance: 'voice',
        verification: 'unverified',
        visibility: 'team',
        author: 'Test A',
        mine: true,
        hidden: false,
        voiceNoteId: 'e2e-v1',
        audioKey: null,
        engine: 'whisper',
        voiceLinks: { ...links, subject: 'E2E carried note', oeuvre_id: 2233 },
        works: [],
        concepts: [],
        proposals: [],
      },
    ],
    changes: [],
    voices: [
      { ...links, id: 'e2e-v1', subject: 'E2E carried note', created_at: `${DAY}T08:59:00Z`, oeuvre_id: 2233, transcript: '', audioKey: null, duration_ms: 30_000, author: 'Test A', mine: true, hasEntry: true },
      { ...links, id: 'e2e-v2', subject: 'E2E pending voice', created_at: `${DAY}T10:00:00Z`, transcript: 'Live words said in the field', audioKey: null, duration_ms: 42_000, author: 'Test A', mine: true, hasEntry: false },
    ],
    creation: [],
    conceptOptions: [],
    inspirations: [],
  }
  const TARGETS = {
    concepts: [{ id: '00000000-0000-4000-8000-000000000001', titre: 'E2E idea', statut: 'idee' }],
    processes: [{ id: '00000000-0000-4000-8000-000000000002', nom: 'E2E project', type: null, statut: null }],
  }

  const reply = (value: unknown) => `0:{"a":"$@1","f":"","b":"development"}\n1:${JSON.stringify(value)}\n`

  function actionId(name: string): string | null {
    const raw = decodeURIComponent(fs.readFileSync(path.join(process.cwd(), '.next/server/server-reference-manifest.json'), 'utf8'))
    return raw.match(new RegExp(`"id":"([0-9a-f]+)","exportedName":"${name}"`))?.[1] ?? null
  }

  async function mock(page: Page, deleted: unknown[][] = []): Promise<unknown[][]> {
    const routed: unknown[][] = []
    await page.route('**/*', async (route: Route) => {
      const req = route.request()
      const id = req.headers()['next-action']
      if (req.method() !== 'POST' || !id) return route.continue()
      const json = (v: unknown) => route.fulfill({ status: 200, contentType: 'text/x-component', body: reply(v) })
      if (id === actionId('getJournalDayExtras')) return json(FAKE_DAY)
      if (id === actionId('listNoteRouteTargets')) return json(TARGETS)
      if (id === actionId('routeVoiceNote')) {
        routed.push(JSON.parse(req.postData() || '[]') as unknown[])
        return json({ ok: true, row: { id: 'e2e-v2', concept_id: null, oeuvre_id: 2233, process_id: null, condition_report_id: null, routed_at: null } })
      }
      if (id === actionId('deleteVoiceNote')) {
        deleted.push(JSON.parse(req.postData() || '[]') as unknown[])
        return json({ ok: true })
      }
      // Never let a write through by accident.
      if (id === actionId('decideJournalLink') || id === actionId('createJournalEntry')) return json({ error: 'e2e' })
      return route.continue()
    })
    return routed
  }

  test('375 px: a pending voice note sits among the entries; « Relier » links it (call recorded only)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const routed = await mock(page)
    await page.goto(`/atelier/journal?day=${DAY}`)
    const voice = page.getByTestId('journal-voice-e2e-v2')
    await expect(voice).toContainText('E2E pending voice', { timeout: 60_000 })
    await expect(voice).toContainText('Live words said in the field')
    await expect(voice).toContainText('0:42')
    await expect(page.getByTestId('journal-entry-990001')).toContainText('E2E carried note')
    // The carried note shows once, as its entry; the old fold is gone.
    await expect(page.getByTestId('journal-voice-e2e-v1')).toHaveCount(0)
    await expect(page.getByTestId('journal-day-voices')).toHaveCount(0)
    // The linked work is a preview chip (thumbnail + title), never the bare number (R4).
    await expect(page.getByTestId('voice-linked-work-e2e-v1').locator('a[href*="work=2233"]')).toBeVisible()

    await page.getByTestId('voice-link-toggle-e2e-v2').click()
    const panel = page.getByTestId('voice-link-panel-e2e-v2')
    await expect(panel).toBeVisible()
    await expect(panel.locator('select').first()).toContainText('E2E idea')
    await page.getByTestId('voice-link-work-e2e-v2').fill('2233')
    await panel.getByRole('button', { name: /^(Relier|Link)$/ }).first().click()
    await expect.poll(() => routed.length, { timeout: 10_000 }).toBe(1)
    expect(routed[0]).toEqual(['e2e-v2', { oeuvre_id: 2233 }])

    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(scroll).toBeLessThanOrEqual(0)
    await voice.scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'test-results/journal-voice-375.png', fullPage: false })
  })

  test('375 px: « Supprimer » asks first, then deletes (call recorded only)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const deleted: unknown[][] = []
    await mock(page, deleted)
    await page.goto(`/atelier/journal?day=${DAY}`)
    await expect(page.getByTestId('journal-voice-e2e-v2')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('voice-delete-e2e-v2').click()
    const ask = page.getByTestId('voice-delete-ask-e2e-v2')
    await expect(ask).toContainText(/corbeille|bin/)
    await ask.scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'test-results/journal-voice-delete-375.png', fullPage: false })
    expect(deleted.length).toBe(0)
    await page.getByTestId('voice-delete-yes-e2e-v2').click()
    await expect.poll(() => deleted.length, { timeout: 10_000 }).toBe(1)
    expect(deleted[0]).toEqual(['e2e-v2'])
    // The carried note (transcript entry) says its entry is hidden, not erased.
    await page.getByTestId('voice-delete-e2e-v1').click()
    await expect(page.getByTestId('voice-delete-ask-e2e-v1')).toContainText(/masquée|hidden/)
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(scroll).toBeLessThanOrEqual(0)
  })

  test('desktop: no « Notes » in the sidebar; /atelier/notes opens the Journal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await mock(page)
    await page.goto(`/atelier/journal?day=${DAY}`)
    await expect(page.getByTestId('journal-voice-e2e-v2')).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('.pem-sidebar-tab').filter({ hasText: /^Journal/ }).first()).toBeVisible()
    await expect(page.locator('.pem-sidebar-tab').filter({ hasText: /^(Notes vocales|Voice notes)/ })).toHaveCount(0)
    await page.getByTestId('voice-link-toggle-e2e-v1').click()
    await expect(page.getByTestId('voice-link-panel-e2e-v1')).toContainText('2233')
    await page.screenshot({ path: 'test-results/journal-voice-desktop.png', fullPage: false })

    await page.goto('/atelier/notes')
    await expect(page).toHaveURL(/\/atelier\/journal/, { timeout: 60_000 })
  })
})
