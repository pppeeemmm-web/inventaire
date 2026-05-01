
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...val] = line.split('=');
    if (key && val) acc[key.trim()] = val.join('=').trim();
    return acc;
  }, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function listTypes() {
  const { data, error } = await supabase.from('suivi_process').select('type');
  if (error) {
    console.error(error);
    return;
  }
  const types = [...new Set(data.map(d => d.type))];
  console.log('Current Pipeline Process Types:');
  types.forEach(t => console.log(`- ${t}`));
}

listTypes();
