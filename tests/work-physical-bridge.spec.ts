import { test, expect } from '@playwright/test'
import { parseWorkIdFromScanText } from '../lib/mobile/parse-work-id-from-scan'
import { workPhysicalBridgePath, workPhysicalBridgeUrl } from '../lib/atelier/work-physical-bridge-url'

test.describe('work physical bridge', () => {
  test('parseWorkIdFromScanText accepts bridge path and query', () => {
    expect(parseWorkIdFromScanText('2190')).toBe(2190)
    expect(parseWorkIdFromScanText('/atelier/works/42')).toBe(42)
    expect(parseWorkIdFromScanText('/atelier/works/42/edit')).toBe(42)
    expect(parseWorkIdFromScanText('https://example.com/atelier/works/99')).toBe(99)
    expect(parseWorkIdFromScanText('https://example.com/atelier?work=7')).toBe(7)
    expect(parseWorkIdFromScanText('not-a-work')).toBeNull()
  })

  test('workPhysicalBridgeUrl uses env origin when set', () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL
    process.env.NEXT_PUBLIC_SITE_URL = 'https://studio.example'
    try {
      expect(workPhysicalBridgePath(12)).toBe('/atelier/works/12')
      expect(workPhysicalBridgeUrl(12)).toBe('https://studio.example/atelier/works/12')
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
      else process.env.NEXT_PUBLIC_SITE_URL = prev
    }
  })
})
