import 'server-only'

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { recordStorageObject } from '@/lib/storage-object-ledger'

/** Vault bucket (documents), EU endpoint only. Same upload as `app/atelier/capture/actions.ts` and
 *  `share-triage/actions.ts` (still their own copies — one R2 helper is stress-test proposal 6). */
export const VAULT_BUCKET = process.env.R2_VAULT_BUCKET ?? 'vault'

export async function vaultR2Put(
  key: string,
  body: Buffer,
  contentType: string,
  source: string,
  uploadedBy?: string | null,
): Promise<void> {
  const accountId = process.env.R2_ACCOUNT_ID ?? ''
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
  await s3.send(new PutObjectCommand({ Bucket: VAULT_BUCKET, Key: key, Body: body, ContentType: contentType }))
  await recordStorageObject({
    bucket: VAULT_BUCKET,
    objectKey: key,
    sizeBytes: body.length,
    contentType,
    source,
    classification: 'linked',
    linkedRefs: [{ table: 'document', column: 'storage_path' }],
    uploadedBy,
  })
}
