import { test, expect } from '@playwright/test'

test.describe('Return window cron route', () => {
  test('rejects unauthenticated POST', async ({ request }) => {
    const res = await request.post('/api/cron/return-window')
    expect([401, 403, 503]).toContain(res.status())
  })
})
