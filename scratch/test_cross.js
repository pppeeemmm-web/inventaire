
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...val] = line.split('=');
    if (key && val) acc[key.trim()] = val.join('=').trim();
    return acc;
  }, {});

async function testCrossBucket() {
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  for (const b of ['paintings', 'vault']) {
    console.log(`--- Testing Bucket: ${b} ---`);
    try {
      await s3.send(new PutObjectCommand({
        Bucket: b,
        Key: 'test-check.txt',
        Body: 'Test',
      }));
      console.log(`✅ SUCCESS for ${b}`);
      await s3.send(new DeleteObjectCommand({ Bucket: b, Key: 'test-check.txt' }));
    } catch (e) {
      console.error(`❌ FAILED for ${b}:`, e.message);
    }
  }
}

testCrossBucket();
