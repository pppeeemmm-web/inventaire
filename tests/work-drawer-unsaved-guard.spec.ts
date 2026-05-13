import { test, expect } from '@playwright/test'

/**
 * Requires ATELIER_E2E=1 and a logged-in session (see inventory-virtual.spec.ts).
 */
test.describe('Work drawer unsaved guard', () => {
  test.skip(!process.env.ATELIER_E2E, 'Set ATELIER_E2E=1 with a logged-in app session.')

  test('switching list row prompts after editing title (inventory preview)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pem_team_tab', 'inventory')
    })
    await page.goto('/atelier')
    await expect(page.getByTestId('inventory-virtual-scroll')).toBeVisible({ timeout: 45_000 })

    const dataRows = page.locator('tbody tr').filter({ has: page.locator('button', { hasText: '✎' }) })
    await expect(dataRows.first()).toBeVisible({ timeout: 15_000 })
    const count = await dataRows.count()
    test.skip(count < 2, 'Need at least two inventory rows for this scenario.')

    await dataRows.nth(0).click()
    const titreField = page.locator('input[style*="font-size: 24"]').first()
    await expect(titreField).toBeVisible({ timeout: 10_000 })
    await titreField.fill('E2E UNSAVED GUARD')

    await dataRows.nth(1).click()

    await expect(page.getByText(/Modifications non enregistrées|Unsaved changes/)).toBeVisible()
  })

  test('discard close restores contact confidentiality (anonymity)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pem_team_tab', 'inventory')
    })
    await page.goto('/atelier')
    await expect(page.getByTestId('inventory-virtual-scroll')).toBeVisible({ timeout: 45_000 })

    const dataRows = page.locator('tbody tr').filter({ has: page.locator('button', { hasText: '✎' }) })
    await expect(dataRows.first()).toBeVisible({ timeout: 15_000 })

    await dataRows.first().click()
    await expect(page.getByTestId('work-drawer-overlay')).toBeVisible({ timeout: 15_000 })

    const anon0 = page.getByTestId('work-drawer-anonymity-0')
    const anon1 = page.getByTestId('work-drawer-anonymity-1')
    const anon2 = page.getByTestId('work-drawer-anonymity-2')

    const pressed = async (loc: ReturnType<typeof page.getByTestId>) =>
      (await loc.getAttribute('aria-pressed')) === 'true'

    let initial: 0 | 1 | 2 = 0
    if (await pressed(anon1)) initial = 1
    else if (await pressed(anon2)) initial = 2

    const pickOther = initial === 0 ? anon1 : anon0
    await pickOther.click()
    await expect(pickOther).toHaveAttribute('aria-pressed', 'true')

    await page.getByTestId('work-drawer-dismiss-backdrop').click({ position: { x: 4, y: 4 } })
    await expect(page.getByText(/Modifications non enregistrées|Unsaved changes/)).toBeVisible()
    await page.getByRole('button', { name: /Quitter sans enregistrer|Close without saving/ }).click()
    await expect(page.getByTestId('work-drawer-overlay')).toBeHidden()

    await dataRows.first().click()
    await expect(page.getByTestId('work-drawer-overlay')).toBeVisible({ timeout: 15_000 })
    if (initial === 0) await expect(anon0).toHaveAttribute('aria-pressed', 'true')
    else if (initial === 1) await expect(anon1).toHaveAttribute('aria-pressed', 'true')
    else await expect(anon2).toHaveAttribute('aria-pressed', 'true')
  })

  test('?work= opens drawer (deep link)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pem_team_tab', 'inventory')
    })
    await page.goto('/atelier')
    await expect(page.getByTestId('inventory-virtual-scroll')).toBeVisible({ timeout: 45_000 })

    const dataRows = page.locator('tbody tr').filter({ has: page.locator('button', { hasText: '✎' }) })
    await expect(dataRows.first()).toBeVisible({ timeout: 15_000 })
    const idCell = dataRows.first().locator('td').nth(2)
    const idText = (await idCell.innerText()).trim().replace(/\s*🔒\s*/g, '').trim()
    const workId = parseInt(idText, 10)
    test.skip(Number.isNaN(workId), 'Could not read work id from first inventory row.')

    await page.goto(`/atelier?work=${workId}`)
    await expect(page.getByTestId('work-drawer-overlay')).toBeVisible({ timeout: 15_000 })
  })
})
