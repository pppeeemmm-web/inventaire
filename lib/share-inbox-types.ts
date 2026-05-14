/** `share_inbox.payload` JSON — versioned for forward compatibility. */
export type ShareInboxPayloadV1 = {
  v: 1
  title?: string | null
  text?: string | null
  urls: string[]
  files: Array<{
    r2_key: string
    name: string
    mime: string
    bytes: number
  }>
}

export function isShareInboxPayloadV1(x: unknown): x is ShareInboxPayloadV1 {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return o.v === 1 && Array.isArray(o.urls) && Array.isArray(o.files)
}
