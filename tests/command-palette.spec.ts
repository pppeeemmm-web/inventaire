import { test, expect } from '@playwright/test'

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/atelier')
    // Wait for the atelier shell to load
    await page.waitForSelector('[title="Ctrl+K"]', { timeout: 10000 })
  })

  test('opens on Ctrl+K button click', async ({ page }) => {
    await page.click('[title="Ctrl+K"]')
    await expect(page.locator('input[type="search"]').first()).toBeVisible()
  })

  test('opens on Ctrl+K keyboard shortcut', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await expect(page.locator('input[type="search"]').first()).toBeVisible()
  })

  test('closes on Escape', async ({ page }) => {
    await page.click('[title="Ctrl+K"]')
    await expect(page.locator('input[type="search"]').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('input[type="search"]').first()).not.toBeVisible()
  })

  test('shows quick actions first by default', async ({ page }) => {
    await page.click('[title="Ctrl+K"]')
    const groupHeaders = page.locator('.t-mono-sm')
    await expect(groupHeaders.first()).toHaveText(/Actions rapides|Quick actions/)
    await expect(page.getByRole('button', { name: /Nouvelle session terrain|New field session/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Capturer une œuvre|Capture a work/ })).toBeVisible()
  })

  test('filters results on input', async ({ page }) => {
    await page.click('[title="Ctrl+K"]')
    await page.locator('input[type="search"]').first().fill('inv')
    // Should show inventory tab match
    await expect(page.locator('button').filter({ hasText: /[Ii]nventaire|[Ii]nventory/ }).first()).toBeVisible()
  })
})
