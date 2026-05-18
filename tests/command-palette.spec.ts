import { test, expect } from '@playwright/test'

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/atelier')
    // Wait for the atelier shell to load
    await page.getByRole('button', { name: /Ouvrir la palette de commandes|Open command palette/ }).waitFor({ timeout: 10000 })
  })

  test('opens on search button click', async ({ page }) => {
    await page.getByRole('button', { name: /Ouvrir la palette de commandes|Open command palette/ }).click()
    await expect(page.locator('input[type="search"]').first()).toBeVisible()
  })

  test('opens on Ctrl+K keyboard shortcut', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await expect(page.locator('input[type="search"]').first()).toBeVisible()
  })

  test('closes on Escape', async ({ page }) => {
    await page.getByRole('button', { name: /Ouvrir la palette de commandes|Open command palette/ }).click()
    await expect(page.locator('input[type="search"]').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('input[type="search"]').first()).not.toBeVisible()
  })

  test('shows quick actions first by default', async ({ page }) => {
    await page.getByRole('button', { name: /Ouvrir la palette de commandes|Open command palette/ }).click()
    const firstGroup = page.locator('input[type="search"] + div .t-mono-sm').first()
    await expect(firstGroup).toHaveText(/Actions rapides|Quick actions/)
    await expect(page.getByRole('button', { name: /Capturer une session|Capture session/ })).toBeVisible()
  })

  test('filters results on input', async ({ page }) => {
    await page.getByRole('button', { name: /Ouvrir la palette de commandes|Open command palette/ }).click()
    await page.locator('input[type="search"]').first().fill('inv')
    // Should show inventory tab match
    await expect(page.locator('button').filter({ hasText: /[Ii]nventaire|[Ii]nventory/ }).first()).toBeVisible()
  })
})
