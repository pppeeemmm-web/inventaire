
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');

// Simple manual env loader
const env = fs.readFileSync('.env.local', 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...val] = line.split('=');
    if (key && val) acc[key.trim()] = val.join('=').trim();
    return acc;
  }, {});

async function testR2() {
  console.log('Testing R2 connection...');
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  try {
    const { Buckets } = await s3.send(new ListBucketsCommand({}));
    console.log('Successfully connected!');
    const bucketNames = Buckets?.map(b => b.Name) || [];
    console.log('Buckets your API key can see:', bucketNames);
    
    if (!bucketNames.includes(env.R2_VAULT_BUCKET)) {
      console.log(`\n!!! ERROR: Your API key CANNOT see the bucket "${env.R2_VAULT_BUCKET}".`);
      console.log('Reason: Your Cloudflare API Token was likely created with access only to the "paintings" bucket.');
      console.log('Solution: Create a new R2 API Token with "Admin Read/Write" or "Edit" permissions for ALL buckets.');
    } else {
      console.log('\nSUCCESS: The bucket is visible. The error might have been a temporary sync issue.');
    }
  } catch (e) {
    console.error('Connection failed:', e.message);
  }
}

testR2();
