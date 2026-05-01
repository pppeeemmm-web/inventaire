
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3'

async function testR2() {
  console.log('Testing R2 connection...')
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  })

  try {
    const { Buckets } = await s3.send(new ListBucketsCommand({}))
    console.log('Successfully connected!')
    console.log('Buckets your API key can see:', Buckets?.map(b => b.Name))
    
    if (!Buckets?.find(b => b.Name === process.env.R2_VAULT_BUCKET)) {
      console.error(`ERROR: Your API key CANNOT see the bucket "${process.env.R2_VAULT_BUCKET}".`)
      console.log('You likely need to create a new API token in Cloudflare with "Admin Read/Write" or access to both buckets.')
    }
  } catch (e) {
    console.error('Connection failed:', e)
  }
}

testR2()
