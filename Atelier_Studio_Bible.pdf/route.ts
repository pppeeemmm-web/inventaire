import { createClient } from '@/lib/supabase/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { redirect } from 'next/navigation'

const BUCKET = process.env.R2_VAULT_BUCKET ?? 'vault'

function r2Client() {
  const accountId = process.env.R2_ACCOUNT_ID ?? ''
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID     ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
}

export async function GET() {
  const supabase = await createClient()
  
  // Find the latest 'bible' in the vault
  const { data: doc } = await supabase
    .from('document')
    .select('storage_path')
    .eq('kind', 'bible')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!doc?.storage_path) {
    return new Response('Studio Bible not found in vault.', { status: 404 })
  }

  // Generate a short-lived signed URL for the PDF
  try {
    const s3 = r2Client()
    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: doc.storage_path })
    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 }) // 1 minute
    
    // Redirect to the signed R2 URL
    redirect(url)
  } catch (e) {
    return new Response(`Failed to generate signed URL: ${String(e)}`, { status: 500 })
  }
}
