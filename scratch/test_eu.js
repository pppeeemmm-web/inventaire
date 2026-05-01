
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...val] = line.split('=');
    if (key && val) acc[key.trim()] = val.join('=').trim();
    return acc;
  }, {});

async function testEUEndpoint() {
  const accountId = env.R2_ACCOUNT_ID;
  // Try the EU-specific endpoint
  const euEndpoint = `https://${accountId}.eu.r2.cloudflarestorage.com`;
  
  console.log(`Testing EU Endpoint: ${euEndpoint}`);
  
  const s3 = new S3Client({
    region: 'auto',
    endpoint: euEndpoint,
    credentials: {
      accessKeyId:     env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  try {
    await s3.send(new PutObjectCommand({
      Bucket: env.R2_VAULT_BUCKET,
      Key: 'eu-test.txt',
      Body: 'EU Test Success',
    }));
    console.log('✅ SUCCESS! The EU endpoint is required.');
    await s3.send(new DeleteObjectCommand({ Bucket: env.R2_VAULT_BUCKET, Key: 'eu-test.txt' }));
  } catch (e) {
    console.error('❌ FAILED with EU endpoint:', e.message);
  }
}

testEUEndpoint();
