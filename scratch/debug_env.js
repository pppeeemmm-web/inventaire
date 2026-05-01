
const fs = require('fs');
const content = fs.readFileSync('.env.local', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('R2_')) {
    const [key, val] = line.split('=');
    if (val) {
      console.log(`${key}: "${val.trim()}" (Length: ${val.trim().length})`);
    }
  }
});
