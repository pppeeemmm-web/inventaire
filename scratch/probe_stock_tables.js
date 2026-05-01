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

async function probe() {
  const tables = ['item', 'produit', 'product', 'article', 'inventory', 'stock_movement', 'stock_item', 'supplier'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) {
      console.log(`Table "${t}" EXISTS.`);
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`Table "${t}" does NOT exist (or error: ${error.message}).`);
    }
  }
}

probe();
