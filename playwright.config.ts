import { defineConfig, devices } from '@playwright/test'

// E2E_TARGET (docs/design/2026-11-23/TestsOnDockerCopy.md): `live` (default) = the dev server on :3000, which uses
// the live database — specs tagged `@writes` are skipped there. `stress` = the throwaway copy's server
// (scripts/stress/e2e.mjs starts it; run-atelier-e2e.mjs --target stress checks it is the copy): no webServer here.
const stress = process.env.E2E_TARGET === 'stress'
const stressBase = `http://127.0.0.1:${Number(process.env.STRESS_PORT) || 3077}`
if (stress && process.env.PLAYWRIGHT_BASE_URL && process.env.PLAYWRIGHT_BASE_URL !== stressBase) {
  throw new Error(`E2E_TARGET=stress runs only against the copy (${stressBase}), not ${process.env.PLAYWRIGHT_BASE_URL}`)
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  grepInvert: stress ? undefined : /@writes/,
  webServer: stress
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
  use: {
    baseURL: stress ? stressBase : (process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000'),
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
