import { test, expect, type Page } from '@playwright/test'

/**
 * Phone « Aujourd'hui » at /hub (R2 step 2, docs/design/2026-11-17/PhoneToday.notes.md):
 * streamed day page (also /hub/today), shared PhoneInputBar; the former launcher rows (« Bureau ») are the
 * ☰ menu sheet's « Actions » fold since the phone navigation build (docs/design/2026-11-18/PhoneNav.notes.md).
 * Requires authenticated session — same as other ATELIER_E2E tests.
 */
test.describe('Hub « Aujourd’hui » (R2)', () => {
  test.skip(
    !process.env.ATELIER_E2E,
    'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.',
  )

  test.use({ viewport: { width: 375, height: 812 } })

  async function openHub(page: Page) {
    await page.goto('/hub')
    await expect(page.getByTestId('hub-today-root')).toBeVisible({ timeout: 45_000 })
  }

  /** ☰ → menu sheet → « Actions » fold (ex-Bureau). */
  async function openBureau(page: Page) {
    await page.getByTestId('phone-menu-open').click()
    await page.getByTestId('phone-menu-actions').locator('summary').click({ timeout: 45_000 })
  }

  test('input bar is in the viewport with 44 px+ buttons, no horizontal scroll', async ({ page }) => {
    await openHub(page)
    const bar = page.getByTestId('phone-input-bar')
    await expect(bar).toBeInViewport()
    for (const id of ['write', 'voice', 'work', 'doc']) {
      const box = await page.getByTestId(`phone-bar-${id}`).boundingBox()
      expect(box).not.toBeNull()
      if (box) expect(box.height).toBeGreaterThanOrEqual(44)
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })

  test('day sections stream in', async ({ page }) => {
    await openHub(page)
    await expect(page.getByTestId('hub-today-summary')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('hub-today-works')).toBeVisible()
    await expect(page.getByTestId('hub-today-entries')).toBeVisible()
  })

  test('menu « Actions » holds the former launcher rows', async ({ page }) => {
    await openHub(page)
    await openBureau(page)
    for (const id of ['pipeline', 'sale', 'triage', 'contact', 'document', 'issue']) {
      await expect(page.getByTestId(`hub-field-verb-${id}`)).toBeVisible()
    }
  })

  test('Écrire opens the writing sheet over the day (no page change)', async ({ page }) => {
    await openHub(page)
    await page.getByTestId('phone-bar-write').click()
    await expect(page.getByTestId('day-write-sheet')).toBeVisible({ timeout: 45_000 })
    await expect(page).toHaveURL(/\/hub/)
  })

  test('the phone Journal day opens in the day screen, with ?write= kept', async ({ page }) => {
    await page.goto('/atelier/journal?today=1&write=1')
    await expect(page).toHaveURL(/\/hub/, { timeout: 45_000 })
    await expect(page.getByTestId('day-write-sheet')).toBeVisible({ timeout: 45_000 })
  })

  test('☰ opens the menu sheet at once, with the tiles and the search', async ({ page }) => {
    await openHub(page)
    await page.getByTestId('phone-menu-open').click()
    await expect(page.getByTestId('phone-menu-sheet')).toBeVisible({ timeout: 45_000 })
    await expect(page).toHaveURL(/\/hub/)
    for (const id of ['today', 'works', 'production', 'ideas', 'orders', 'logistics', 'events', 'journal']) {
      const box = await page.getByTestId(`phone-menu-tile-${id}`).boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
    await expect(page.getByTestId('phone-menu-search')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })

  test('Vocal opens the voice note sheet', async ({ page }) => {
    await openHub(page)
    await page.getByTestId('phone-bar-voice').click()
    await expect(page.getByTestId('ring-b-voice-sheet')).toBeVisible()
    // Recording starts on open; with a real mic, cancel it — otherwise close the blocked panel.
    if ((await page.getByTestId('ring-b-voice-sheet').getAttribute('data-phase')) === 'recording') {
      await page.getByTestId('ring-b-voice-cancel').click()
      await page.getByRole('button', { name: /Jeter|Throw away/ }).click()
    } else {
      await page.getByTestId('ring-b-voice-sheet-close').click()
    }
    await expect(page.getByTestId('ring-b-voice-sheet')).not.toBeVisible()
  })

  test('Photo · doc › Document opens capture with doc mode', async ({ page }) => {
    await openHub(page)
    await page.getByTestId('phone-bar-doc').click()
    await page.getByRole('link', { name: /Document/ }).first().click()
    await expect(page).toHaveURL(/\/atelier\/capture\?.*mode=doc/, { timeout: 45_000 })
  })

  test('Œuvre starts with the choice; Reprise opens the recording screen on Reprise', async ({ page }) => {
    await openHub(page)
    await page.getByTestId('phone-bar-work').click()
    await expect(page.getByTestId('phone-work-sheet')).toBeVisible()
    for (const id of ['new', 'reprise', 'session']) await expect(page.getByTestId(`phone-work-${id}`)).toBeVisible()
    await page.getByTestId('phone-work-reprise').click()
    await expect(page).toHaveURL(/\/atelier\/works\/new\?record=reprise/, { timeout: 45_000 })
    await expect(page.getByTestId('work-record-mode-reprise')).toHaveAttribute('aria-pressed', 'true', { timeout: 45_000 })
  })

  test('journal list opens the voice note sheet', async ({ page }) => {
    await page.goto('/atelier/journal')
    await page.getByTestId('phone-bar-voice').click({ timeout: 45_000 })
    await expect(page.getByTestId('ring-b-voice-sheet')).toBeVisible()
    if ((await page.getByTestId('ring-b-voice-sheet').getAttribute('data-phase')) === 'recording') {
      await page.getByTestId('ring-b-voice-cancel').click()
      await page.getByRole('button', { name: /Jeter|Throw away/ }).click()
    } else {
      await page.getByTestId('ring-b-voice-sheet-close').click()
    }
    await expect(page.getByTestId('ring-b-voice-sheet')).not.toBeVisible()
  })

  test('Bureau › pipeline opens atelier pipeline tab', async ({ page }) => {
    await openHub(page)
    await openBureau(page)
    await page.getByTestId('hub-field-verb-pipeline').click()
    await expect(page).toHaveURL(/\/atelier\/pipeline/, { timeout: 45_000 })
  })

  test('Bureau › sale opens mobile sale flow', async ({ page }) => {
    await openHub(page)
    await openBureau(page)
    await page.getByTestId('hub-field-verb-sale').click()
    await expect(page).toHaveURL(/\/atelier\/sale\/new/, { timeout: 45_000 })
  })

  test('Bureau › triage opens field triage deck', async ({ page }) => {
    await openHub(page)
    await openBureau(page)
    await page.getByTestId('hub-field-verb-triage').click()
    await expect(page).toHaveURL(/\/atelier\/triage/, { timeout: 45_000 })
  })

  test('Bureau › issue opens studio issue form', async ({ page }) => {
    await openHub(page)
    await openBureau(page)
    // An « Actions » row: centre it so nothing covers it.
    const issue = page.getByTestId('hub-field-verb-issue')
    await issue.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await issue.click()
    await expect(page).toHaveURL(/\/atelier\/issue\/new/, { timeout: 45_000 })
    await expect(page.getByTestId('issue-work-select')).toBeVisible()
    await expect(page.getByTestId('issue-action-type-select')).toBeVisible()
  })
})
