const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://mcrzsxrcoexnlwmaunte.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4');

async function check() {
  const { data, error } = await s.rpc('get_tables'); // If a helper function exists
  // Or just try a generic query
  const { data: tables, error: err } = await s.from('information_schema.tables').select('table_name').eq('table_schema', 'public');
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Tables:', tables.map(t => t.table_name));
  }
}
check();
