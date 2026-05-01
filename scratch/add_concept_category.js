const { createClient } = require('@supabase/supabase-js')

const supabase = createClient('https://mcrzsxrcoexnlwmaunte.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4')

async function main() {
  const { error } = await supabase.rpc('run_sql', { sql: `
    ALTER TABLE concept ADD COLUMN IF NOT EXISTS category text DEFAULT 'artistic';
  `})
  if (error) console.error(error)
  else console.log('Category column added.')
}

main()
