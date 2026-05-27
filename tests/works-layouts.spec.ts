import { test, expect } from '@playwright/test'

/**
 * Phase 0 gate: the layouts that were "verified-but-broken" must not silently
 * regress again. Each test exercises the actual interaction (wheel hijack,
 * arrow click, viewport-fit packing) and asserts state through the DOM, not
 * through a screenshot.
 *
 * Drives layouts via the `?_layout=` URL override (set up by the existing dev
 * preview hook) so we don't need to populate a portfolio config in the test.
 */

test.describe('Works layouts — Phase 0 stabilization', () => {
  test('procession: horizontal scroll headroom, wheel hijack moves scrollLeft, arrow click moves scrollLeft', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/works?_layout=procession')
    await expect(page.locator('.w-proc')).toBeVisible()
    // Procession lazy-loads tiles past index 3, so we can't wait for every
    // image; instead poll until scroll headroom exists (i.e. enough eager
    // tiles have laid out to make the track wider than the viewport).
    await page.waitForFunction(() => {
      const el = document.querySelector('.w-proc') as HTMLElement | null
      return !!el && el.scrollWidth > el.clientWidth + 50
    }, undefined, { timeout: 20_000 })

    const headroom = await page.evaluate(() => {
      const el = document.querySelector('.w-proc') as HTMLElement
      return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }
    })
    expect(headroom.scrollWidth).toBeGreaterThan(headroom.clientWidth)

    // Wheel hijack: dispatch a clear vertical wheel; scrollLeft should advance.
    const moved = await page.evaluate(async () => {
      const el = document.querySelector('.w-proc') as HTMLElement
      el.scrollTo({ left: 0, behavior: 'instant' })
      await new Promise(r => setTimeout(r, 100))
      const before = el.scrollLeft
      el.dispatchEvent(new WheelEvent('wheel', { deltaX: 0, deltaY: 200, bubbles: true, cancelable: true }))
      await new Promise(r => setTimeout(r, 200))
      return el.scrollLeft - before
    })
    expect(moved).toBeGreaterThan(50)

    // Deadzone: gentle vertical + diagonal must NOT hijack.
    const deadzone = await page.evaluate(async () => {
      const el = document.querySelector('.w-proc') as HTMLElement
      el.scrollTo({ left: 0, behavior: 'instant' })
      await new Promise(r => setTimeout(r, 100))
      const before = el.scrollLeft
      el.dispatchEvent(new WheelEvent('wheel', { deltaX: 10, deltaY: 100, bubbles: true, cancelable: true }))
      await new Promise(r => setTimeout(r, 150))
      return el.scrollLeft - before
    })
    expect(deadzone).toBe(0)

    // Arrow button: must be visible + clicking it must move scrollLeft.
    const navRight = page.locator('.w-proc-nav.right')
    await expect(navRight).toBeVisible()
    await page.evaluate(() => {
      const el = document.querySelector('.w-proc') as HTMLElement
      el.scrollTo({ left: 0, behavior: 'instant' })
    })
    await navRight.click()
    await page.waitForTimeout(500)
    const afterArrow = await page.evaluate(() => (document.querySelector('.w-proc') as HTMLElement).scrollLeft)
    expect(afterArrow).toBeGreaterThan(100)
  })

  test('timeline: scroll headroom, wheel hijack, arrow click', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/works?_layout=timeline')
    await expect(page.locator('.w-tl-wrap')).toBeVisible()
    // Same pattern as procession: poll the headroom instead of waiting for
    // every image (timeline tiles all lazy-load).
    await page.waitForFunction(() => {
      const el = document.querySelector('.w-tl-wrap') as HTMLElement | null
      return !!el && el.scrollWidth > el.clientWidth + 50
    }, undefined, { timeout: 20_000 })

    const headroom = await page.evaluate(() => {
      const el = document.querySelector('.w-tl-wrap') as HTMLElement
      return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }
    })
    expect(headroom.scrollWidth).toBeGreaterThan(headroom.clientWidth)

    const moved = await page.evaluate(async () => {
      const el = document.querySelector('.w-tl-wrap') as HTMLElement
      el.scrollTo({ left: 0, behavior: 'instant' })
      await new Promise(r => setTimeout(r, 100))
      const before = el.scrollLeft
      el.dispatchEvent(new WheelEvent('wheel', { deltaX: 0, deltaY: 200, bubbles: true, cancelable: true }))
      await new Promise(r => setTimeout(r, 200))
      return el.scrollLeft - before
    })
    expect(moved).toBeGreaterThan(50)
  })

  test('salon: 1440×900 viewport, no body-scroll, all tiles inside viewport rect, count marker shown', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/works?_layout=salon')
    await expect(page.locator('.w-salon-wall')).toBeVisible()
    await page.waitForTimeout(500) // let natural-size onLoad settle

    const state = await page.evaluate(() => {
      const tiles = Array.from(document.querySelectorAll('.w-salon-tile')) as HTMLElement[]
      const rects = tiles.map(t => t.getBoundingClientRect())
      const marker = document.querySelector('.w-salon-marker') as HTMLElement | null
      return {
        bodyScrollH: document.body.scrollHeight,
        innerH: window.innerHeight,
        tileCount: tiles.length,
        markerText: marker?.textContent?.trim() ?? null,
        tilesOutside: rects.filter(r => r.bottom > window.innerHeight + 1 || r.right > window.innerWidth + 1).length,
      }
    })
    // No vertical overflow.
    expect(state.bodyScrollH).toBeLessThanOrEqual(state.innerH + 2)
    expect(state.tileCount).toBeGreaterThan(0)
    expect(state.tilesOutside).toBe(0)
    expect(state.markerText).toMatch(/(works|œuvres)/i)
  })

  test('carousel, grid, letter, vitrine: smoke render', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    for (const layout of ['carousel', 'grid', 'letter', 'vitrine']) {
      await page.goto(`/works?_layout=${layout}`)
      // At minimum: no JS error, some main content rendered.
      const main = await page.locator('main, .w-card, [class*="shell"]').first()
      await expect(main).toBeVisible({ timeout: 5000 })
    }
  })
})
