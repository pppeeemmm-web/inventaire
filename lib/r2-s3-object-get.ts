/**
 * GET from R2 paintings bucket (same EU endpoint as r2PutObject in r2-s3-object.ts).
 */
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

let _s3: S3Client | null = null

function r2PaintingsClient(): S3Client {
  if (_s3) return _s3
  const accountId = process.env.R2_ACCOUNT_ID ?? ''
  _s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID     ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
  return _s3
}

export async function r2GetObjectBuffer(key: string): Promise<Buffer | null> {
  const bucket = (process.env.R2_BUCKET ?? 'paintings').trim()
  const s3 = r2PaintingsClient()
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    if (!out.Body) return null
    const bytes = await out.Body.transformToByteArray()
    return Buffer.from(bytes)
  } catch {
    return null
  }
}
