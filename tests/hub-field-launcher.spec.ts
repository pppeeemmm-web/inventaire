import { test, expect, type Page } from '@playwright/test'

/**
 * Phone « Aujourd'hui » at /hub (R2 step 2, docs/design/2026-11-17/PhoneToday.notes.md):
 * streamed day page (also /hub/today), shared PhoneInputBar, Bureau fold with the former launcher rows.
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

  async function openBureau(page: Page) {
    await page.getByTestId('hub-today-bureau').locator('summary').click()
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

  test('Bureau holds the former launcher rows', async ({ page }) => {
    await openHub(page)
    await openBureau(page)
    for (const id of ['pipeline', 'sale', 'triage', 'contact', 'document', 'issue']) {
      await expect(page.getByTestId(`hub-field-verb-${id}`)).toBeVisible()
    }
  })

  test('Écrire opens today in the journal with the form', async ({ page }) => {
    await openHub(page)
    await page.getByTestId('phone-bar-write').click()
    await expect(page).toHaveURL(/\/atelier\/journal/)
    await expect(page.getByTestId('journal-entry-form')).toBeVisible({ timeout: 45_000 })
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

  test('journal day opens the voice note sheet', async ({ page }) => {
    await page.goto('/atelier/journal?today=1')
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
    await expect(page).toHaveURL(/\/atelier\/pipeline/)
  })

  test('Bureau › sale opens mobile sale flow', async ({ page }) => {
    await openHub(page)
    await openBureau(page)
    await page.getByTestId('hub-field-verb-sale').click()
    await expect(page).toHaveURL(/\/atelier\/sale\/new/)
  })

  test('Bureau › triage opens field triage deck', async ({ page }) => {
    await openHub(page)
    await openBureau(page)
    await page.getByTestId('hub-field-verb-triage').click()
    await expect(page).toHaveURL(/\/atelier\/triage/)
  })

  test('Bureau › issue opens studio issue form', async ({ page }) => {
    await openHub(page)
    await openBureau(page)
    // Last Bureau row: centre it so the fixed input bar does not cover it.
    const issue = page.getByTestId('hub-field-verb-issue')
    await issue.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await issue.click()
    await expect(page).toHaveURL(/\/atelier\/issue\/new/, { timeout: 45_000 })
    await expect(page.getByTestId('issue-work-select')).toBeVisible()
    await expect(page.getByTestId('issue-action-type-select')).toBeVisible()
  })
})
