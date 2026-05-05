const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://mcrzsxrcoexnlwmaunte.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4');

async function check() {
  const { count, error } = await s.from('expense').select('*', { count: 'exact', head: true });
  if (error) {
    console.error('Expense check error:', error.message);
  } else {
    console.log('Expense count:', count);
  }
}
check();
