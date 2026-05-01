
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...val] = line.split('=');
    if (key && val) acc[key.trim()] = val.join('=').trim();
    return acc;
  }, {});

async function testUpload() {
  console.log(`Attempting to upload to bucket: ${env.R2_VAULT_BUCKET}...`);
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  const key = 'test-connection.txt';
  try {
    // 1. Upload
    await s3.send(new PutObjectCommand({
      Bucket: env.R2_VAULT_BUCKET,
      Key: key,
      Body: 'Connection Test Success',
      ContentType: 'text/plain'
    }));
    console.log('✅ UPLOAD SUCCESSFUL!');

    // 2. Cleanup
    await s3.send(new DeleteObjectCommand({
      Bucket: env.R2_VAULT_BUCKET,
      Key: key
    }));
    console.log('✅ CLEANUP SUCCESSFUL!');
    console.log('\nYour new API keys are working perfectly. You can now use the Vault in your app.');
  } catch (e) {
    console.error('❌ UPLOAD FAILED:', e.message);
    if (e.message.includes('NoSuchBucket')) {
      console.log('Wait... Cloudflare still says the bucket does not exist. Check if there are multiple accounts or if the bucket name "vault" has any typos in the Cloudflare UI.');
    }
  }
}

testUpload();
