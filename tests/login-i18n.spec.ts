import { test, expect } from '@playwright/test'

test.describe('Login page locale', () => {
  test('FR / EN toggle swaps login copy via dictionary', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pem_lang', 'fr')
    })
    await page.goto('/login')
    await expect(page.getByText('Accès restreint.', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: /^EN$/ }).click()
    await expect(page.getByText('Restricted access.', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: /^FR$/ }).click()
    await expect(page.getByText('Accès restreint.', { exact: true })).toBeVisible()
  })

  test('email/password form labels follow locale', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pem_lang', 'en')
    })
    await page.goto('/login')
    await expect(page.getByTestId('login-email-form')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()

    await page.getByRole('button', { name: /^FR$/ }).click()
    await expect(page.getByLabel('E-mail')).toBeVisible()
    await expect(page.getByLabel('Mot de passe')).toBeVisible()
  })

  test('forgot password opens recovery flow', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-forgot-password').click()
    await expect(page.getByTestId('login-recover-form')).toBeVisible()
    await page.getByTestId('login-back-to-sign-in').click()
    await expect(page.getByTestId('login-email-form')).toBeVisible()
  })
})
