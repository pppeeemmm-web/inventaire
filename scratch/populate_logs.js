const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://mcrzsxrcoexnlwmaunte.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4');

async function run() {
  const logs = [
    { type: 'feature', label: 'Stock-take Inventory Audit', details: 'Added physical quantity verification with automatic discrepancy calculation.', status: 'completed' },
    { type: 'data', label: 'Material Import (178 items)', details: 'Migrated studio supplies from Excel files into the stock database.', status: 'completed' },
    { type: 'data', label: 'Docket Processing Pipeline', details: 'Integrated digital receipt processing for Jackson\'s, Couleurs Leroux, and Kremer Pigmente.', status: 'active' },
    { type: 'ui', label: 'Hub Intelligence Optimization', details: 'Redesigned Hub into a no-scroll executive dashboard surfacing Live Pipeline & Ideas.', status: 'completed' }
  ];

  const { data, error } = await s.from('system_log').insert(logs);
  if (error) {
    console.error('Error inserting:', error);
  } else {
    console.log('Successfully inserted logs');
  }
}

run();
