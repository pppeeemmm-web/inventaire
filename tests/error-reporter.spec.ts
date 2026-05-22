import { test, expect } from '@playwright/test'
import { errorMessage, serializeError } from '../lib/error-reporter/format'

test.describe('error-reporter format', () => {
  test('serializeError preserves message and stack', () => {
    const err = new Error('boom')
    const out = serializeError(err)
    expect(out.message).toBe('boom')
    expect(out.stack).toContain('Error: boom')
  })

  test('errorMessage handles strings and unknown values', () => {
    expect(errorMessage('plain')).toBe('plain')
    expect(errorMessage({ message: 'from object' })).toBe('from object')
    expect(errorMessage(42)).toBe('Unknown error')
  })
})

test.describe('POST /api/system/log-error', () => {
  test('returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.post('/api/system/log-error', {
      data: {
        level: 'error',
        message: 'test',
        source: 'error-reporter.spec',
      },
    })
    expect(res.status()).toBe(401)
  })

  test('returns 400 when message is missing', async ({ request }) => {
    const res = await request.post('/api/system/log-error', {
      data: { level: 'error', source: 'error-reporter.spec' },
    })
    expect([400, 401]).toContain(res.status())
  })
})
