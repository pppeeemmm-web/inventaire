import { test, expect, type Page } from '@playwright/test'

/**
 * Phone guard (docs/design/2026-11-28/PhonePattern.md): every Atelier tab at 375 px.
 * - nothing visible pokes out of the screen sideways (the shell is fixed and scrolls inside, so the document's
 *   own width proves nothing — each visible element is measured, except inside a row that scrolls or clips on
 *   purpose, like the sections pills);
 * - the header title fits its box (a title wider than its box spilled over the count before 2026-11-28);
 * - no visible text field narrower than 120 px.
 * Tabs not yet moved onto the shared phone pieces are in PENDING: their test is expected to fail (test.fail), so a
 * pending tab that starts passing turns the run red — remove it from the list then. The list may only shrink.
 * Requires a logged-in session (ATELIER_E2E=1), like the other field specs.
 */
const TABS = [
  'overview', 'inventory', 'reports', 'themes', 'chronologie', 'production', 'logistics', 'sales', 'exhibitions',
  'vault', 'contacts', 'pipeline', 'fiscal', 'concepts', 'stock', 'journal', 'kaizen-ops', 'aide',
] as const

/** PhonePattern.md group A still on their desk layout. */
/** Fiscal: its expenses table is framed, but « par année » is still a desk layout. */
const PENDING = new Set<string>(['reports', 'vault', 'contacts', 'fiscal'])

async function phoneProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    const W = window.innerWidth
    // On purpose: a short row that scrolls sideways (pills, chips), anything clipped, or a frame marked
    // data-phone-scroll-x (a table of figures kept as a table). A tall area scrolling sideways is the bug.
    const intended = (p: Element): boolean => {
      const ox = getComputedStyle(p).overflowX
      if (ox === 'hidden' || ox === 'clip' || p.hasAttribute('data-phone-scroll-x')) return true
      return (ox === 'auto' || ox === 'scroll') && p.getBoundingClientRect().height <= 120
    }
    const clips = (el: Element | null): boolean => {
      for (let p = el?.parentElement; p; p = p.parentElement) {
        if (getComputedStyle(p).overflowX !== 'visible') return intended(p) && p.getBoundingClientRect().right <= W + 1
      }
      return false
    }
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const ox = getComputedStyle(el).overflowX
      if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1 && !intended(el)) {
        out.push(`scrolls sideways: <${el.tagName.toLowerCase()}> ${el.scrollWidth}px in ${el.clientWidth}px`)
      }
    }
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue
      if ((r.right > W + 1 || r.left < -1) && !clips(el)) {
        out.push(`pokes out: <${el.tagName.toLowerCase()}> ${(el.textContent ?? '').trim().slice(0, 40)} (${r.left.toFixed(0)}–${r.right.toFixed(0)})`)
        if (out.length > 5) break
      }
    }
    const title = document.querySelector('.t-eyebrow') as HTMLElement | null
    if (title && title.scrollWidth > title.clientWidth + 1 && getComputedStyle(title).overflow === 'visible') {
      out.push('header title wider than its box')
    }
    for (const el of Array.from(document.querySelectorAll('input[type="search"], input[type="text"], input:not([type])'))) {
      const r = (el as HTMLElement).getBoundingClientRect()
      if (r.width > 0 && r.height > 0 && r.width < 120) out.push(`field ${r.width.toFixed(0)}px wide (${(el as HTMLInputElement).placeholder || el.outerHTML.slice(0, 60)})`)
    }
    return out
  })
}

test.describe('Phone pattern guard', () => {
  test.skip(!process.env.ATELIER_E2E, 'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.')
  test.use({ viewport: { width: 375, height: 812 } })

  for (const tab of TABS) {
    test(`${tab} fits a 375 px phone`, async ({ page }) => {
      test.fail(PENDING.has(tab), `${tab}: not yet on the shared phone pieces (PhonePattern.md group A)`)
      await page.goto(`/atelier/${tab}`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('phone-input-bar')).toBeVisible({ timeout: 45_000 })
      await page.waitForTimeout(1500)
      expect(await phoneProblems(page)).toEqual([])
    })
  }

  test('stock: 44 px taps, search, filter sheet, a row opens the editor', async ({ page }) => {
    await page.goto('/atelier/stock', { waitUntil: 'domcontentloaded' })
    const toolbar = page.getByTestId('atelier-stock-phone-toolbar')
    await expect(toolbar).toBeVisible({ timeout: 45_000 })
    const small = await page.getByTestId('atelier-stock-phone').evaluate((root) =>
      Array.from(root.querySelectorAll('button, input'))
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0 && r.height < 44)
        .length)
    expect(small).toBe(0)
    await page.getByTestId('atelier-stock-phone-toolbar-filters').click()
    await expect(page.getByTestId('atelier-stock-phone-filters')).toBeVisible()
    await page.keyboard.press('Escape')
    const first = page.locator('[data-testid^="atelier-stock-row-"]').first()
    if (await first.count()) {
      await first.click()
      await expect(page.getByTestId('atelier-stock-editor')).toBeVisible()
    }
  })
})
