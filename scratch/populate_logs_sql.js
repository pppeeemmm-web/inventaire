const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://mcrzsxrcoexnlwmaunte.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4');

async function run() {
  const sql = `
    INSERT INTO system_log (type, label, details, status) VALUES 
    ('feature', 'Stock-take Inventory Audit', 'Added physical quantity verification with automatic discrepancy calculation.', 'completed'),
    ('data', 'Material Import (178 items)', 'Migrated studio supplies from Excel files into the stock database.', 'completed'),
    ('data', 'Docket Processing Pipeline', 'Integrated digital receipt processing for Jackson''s, Couleurs Leroux, and Kremer Pigmente.', 'active'),
    ('ui', 'Hub Intelligence Optimization', 'Redesigned Hub into a no-scroll executive dashboard surfacing Live Pipeline & Ideas.', 'completed');
  `;
  const { error } = await s.rpc('exec_sql', { sql });
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Successfully inserted logs via SQL');
  }
}

run();
