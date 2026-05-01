import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mcrzsxrcoexnlwmaunte.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4'

async function checkColumns() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data, error } = await supabase
    .rpc('get_column_info', { table_name: 'Oeuvres' })

  if (error) {
    // If RPC doesn't exist, try a raw query via a temporary function or just assume based on error
    console.error('RPC Error:', error)
    
    // Fallback: Try to query information_schema directly if possible (unlikely via REST unless exposed)
    // Instead, let's just try to insert "1999" vs "1999-01-01" to confirm.
  } else {
    console.log('Column info:', data)
  }
}

// Alternative: just try to insert and catch error
async function testInsert() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { error } = await supabase.from('Oeuvres').insert({ Titre: 'Test Date', Année: '1999' }).select()
  console.log('Insert "1999" error:', error?.message)
  
  const { error: error2 } = await supabase.from('Oeuvres').insert({ Titre: 'Test Date 2', Année: '1999-01-01' }).select()
  console.log('Insert "1999-01-01" error:', error2?.message)
}

testInsert()
