/**
 * Minimal R2 S3-compatible PUT/DELETE for non-work uploads (e.g. concept sketches).
 * Mirrors signing logic in app/atelier/works/actions.ts.
 */
import crypto from 'crypto'
import { r2S3Hostname } from '@/lib/r2-s3-host'
import {
  markStorageObject,
  recordStorageObject,
  type StorageObjectClassification,
  type StorageObjectLinkedRef,
} from '@/lib/storage-object-ledger'

export type R2PutObjectLedgerOptions = {
  source?: string
  classification?: StorageObjectClassification
  linkedRefs?: StorageObjectLinkedRef[]
  uploadedBy?: string | null
  metadata?: Record<string, string | number | boolean | null>
}

function r2PutHeaders(buf: Buffer, filename: string, contentType: string): Record<string, string> {
  const account = process.env.R2_ACCOUNT_ID ?? ''
  const accessKey = process.env.R2_ACCESS_KEY_ID!
  const secretKey = process.env.R2_SECRET_ACCESS_KEY!
  const bucket = (process.env.R2_BUCKET ?? 'paintings').trim()
  const host = r2S3Hostname(account)
  const pathname = `/${bucket}/${filename.split('/').map(encodeURIComponent).join('/')}`

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const dateStamp = amzDate.slice(0, 8)
  const bodyHash = crypto.createHash('sha256').update(buf).digest('hex')

  const headers: Record<string, string> = {
    host,
    'content-type': contentType,
    'content-length': String(buf.length),
    'x-amz-date': amzDate,
    'x-amz-content-sha256': bodyHash,
  }

  const sortedKeys = Object.keys(headers).sort()
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${headers[k]}\n`).join('')
  const signedHeaderStr = sortedKeys.join(';')
  const canonicalRequest = ['PUT', pathname, '', canonicalHeaders, signedHeaderStr, bodyHash].join('\n')

  const region = 'auto'
  const service = 's3'
  const credScope = `${dateStamp}/${region}/${service}/aws4_request`
  const strToSign = ['AWS4-HMAC-SHA256', amzDate, credScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n')

  const hmac = (key: Buffer | string, data: string) =>
    crypto.createHmac('sha256', key).update(data).digest()

  const sigKey = hmac(hmac(hmac(hmac('AWS4' + secretKey, dateStamp), region), service), 'aws4_request')
  const sig = crypto.createHmac('sha256', sigKey).update(strToSign).digest('hex')

  headers.Authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope}, SignedHeaders=${signedHeaderStr}, Signature=${sig}`

  return headers
}

export async function r2PutObject(
  buf: Buffer,
  filename: string,
  contentType: string,
  ledger?: R2PutObjectLedgerOptions,
): Promise<void> {
  const account = process.env.R2_ACCOUNT_ID ?? ''
  const bucket = (process.env.R2_BUCKET ?? 'paintings').trim()
  const host = r2S3Hostname(account)
  const url = `https://${host}/${bucket}/${filename.split('/').map(encodeURIComponent).join('/')}`
  const headers = r2PutHeaders(buf, filename, contentType)
  const res = await fetch(url, { method: 'PUT', headers, body: buf as unknown as BodyInit })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`R2 PUT ${res.status}: ${body}`)
  }
  await recordStorageObject({
    bucket,
    objectKey: filename,
    sizeBytes: buf.length,
    contentType,
    source: ledger?.source,
    classification: ledger?.classification,
    linkedRefs: ledger?.linkedRefs,
    uploadedBy: ledger?.uploadedBy,
    metadata: ledger?.metadata,
  })
}

export async function r2DeleteObject(filename: string): Promise<void> {
  const account = process.env.R2_ACCOUNT_ID ?? ''
  const secretKey = process.env.R2_SECRET_ACCESS_KEY!
  const accessKey = process.env.R2_ACCESS_KEY_ID!
  const bucket = (process.env.R2_BUCKET ?? 'paintings').trim()
  const host = r2S3Hostname(account)
  const encodedPath = `/${bucket}/${filename.split('/').map(encodeURIComponent).join('/')}`

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const dateStamp = amzDate.slice(0, 8)
  const bodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

  const headers: Record<string, string> = {
    host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': bodyHash,
  }
  const sortedKeys = Object.keys(headers).sort()
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${headers[k]}\n`).join('')
  const signedHeaderStr = sortedKeys.join(';')
  const canonicalRequest = ['DELETE', encodedPath, '', canonicalHeaders, signedHeaderStr, bodyHash].join('\n')

  const region = 'auto'
  const service = 's3'
  const credScope = `${dateStamp}/${region}/${service}/aws4_request`
  const strToSign = ['AWS4-HMAC-SHA256', amzDate, credScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n')

  const hmac = (key: Buffer | string, data: string) =>
    crypto.createHmac('sha256', key).update(data).digest()
  const sigKey = hmac(hmac(hmac(hmac('AWS4' + secretKey, dateStamp), region), service), 'aws4_request')
  const sig = crypto.createHmac('sha256', sigKey).update(strToSign).digest('hex')

  headers.Authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope}, SignedHeaders=${signedHeaderStr}, Signature=${sig}`

  const url = `https://${host}${encodedPath}`
  const res = await fetch(url, { method: 'DELETE', headers })
  if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE ${res.status}: ${await res.text()}`)
  await markStorageObject({
    bucket,
    objectKey: filename,
    status: 'deleted',
    metadata: { source: 'r2DeleteObject', http_status: res.status },
  })
}

/** SigV4 GET — returns object bytes (used to finalize staged `work-session/*` keys). */
export async function r2GetObjectBuffer(filename: string): Promise<Buffer> {
  const account = process.env.R2_ACCOUNT_ID ?? ''
  const secretKey = process.env.R2_SECRET_ACCESS_KEY!
  const accessKey = process.env.R2_ACCESS_KEY_ID!
  const bucket = (process.env.R2_BUCKET ?? 'paintings').trim()
  const host = r2S3Hostname(account)
  const encodedPath = `/${bucket}/${filename.split('/').map(encodeURIComponent).join('/')}`

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const dateStamp = amzDate.slice(0, 8)
  const bodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

  const headers: Record<string, string> = {
    host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': bodyHash,
  }
  const sortedKeys = Object.keys(headers).sort()
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${headers[k]}\n`).join('')
  const signedHeaderStr = sortedKeys.join(';')
  const canonicalRequest = ['GET', encodedPath, '', canonicalHeaders, signedHeaderStr, bodyHash].join('\n')

  const region = 'auto'
  const service = 's3'
  const credScope = `${dateStamp}/${region}/${service}/aws4_request`
  const strToSign = ['AWS4-HMAC-SHA256', amzDate, credScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n')

  const hmac = (key: Buffer | string, data: string) =>
    crypto.createHmac('sha256', key).update(data).digest()
  const sigKey = hmac(hmac(hmac(hmac('AWS4' + secretKey, dateStamp), region), service), 'aws4_request')
  const sig = crypto.createHmac('sha256', sigKey).update(strToSign).digest('hex')

  headers.Authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope}, SignedHeaders=${signedHeaderStr}, Signature=${sig}`

  const url = `https://${host}${encodedPath}`
  const res = await fetch(url, { method: 'GET', headers })
  if (!res.ok) throw new Error(`R2 GET ${res.status}: ${await res.text()}`)
  return Buffer.from(await res.arrayBuffer())
}
