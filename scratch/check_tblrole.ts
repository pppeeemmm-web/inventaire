import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mcrzsxrcoexnlwmaunte.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4'

async function checkRoles() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data, error } = await supabase
    .from('tblRole')
    .select('*')

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Columns in tblRole:', Object.keys(data[0] || {}))
  console.log('Roles in tblRole:', data)
}

checkRoles()
