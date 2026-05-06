const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkConfig() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: configDoc } = await supabase
    .from('document')
    .select('storage_path')
    .eq('name', 'portfolio_sections.json')
    .maybeSingle();

  if (!configDoc) {
    console.log('No config doc found');
    return;
  }

  console.log('STORAGE PATH:', configDoc.storage_path);

  const { data: fileData, error } = await supabase.storage.from('vault').download(configDoc.storage_path);
  if (error) {
    console.error('Error downloading:', error);
    return;
  }

  const text = await fileData.text();
  console.log('CONFIG CONTENT:');
  console.log(text);
  
  try {
    const parsed = JSON.parse(text);
    console.log('WORKS COLLECTIONS:', parsed.works_collections?.length);
    console.log('ACTIVE COLLECTIONS:', parsed.works_collections?.filter(c => c.is_active).length);
  } catch (e) {
    console.error('Parse error:', e);
  }
}

checkConfig();
