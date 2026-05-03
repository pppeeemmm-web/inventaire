
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const getEnv = (key: string) => {
  const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return match ? match[1].trim() : null
}

async function listVault() {
  const accountId = getEnv('R2_ACCOUNT_ID')
  const accessKey = getEnv('R2_ACCESS_KEY_ID')
  const secretKey = getEnv('R2_SECRET_ACCESS_KEY')
  const bucket    = getEnv('R2_VAULT_BUCKET') || 'vault'

  if (!accountId || !accessKey || !secretKey) {
    console.error('Missing R2 config')
    return
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     accessKey,
      secretAccessKey: secretKey,
    },
  })

  try {
    const { Contents } = await s3.send(new ListObjectsV2Command({ Bucket: bucket }))
    console.log('Vault Objects:', JSON.stringify(Contents?.map(c => c.Key), null, 2))
  } catch (err) {
    console.error('Error listing vault:', err)
  }
}

listVault()
