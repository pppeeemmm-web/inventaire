import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mcrzsxrcoexnlwmaunte.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4'

async function updateActionType() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { error } = await supabase
    .from('work_action_type')
    .update({ field_key: 'Montee' })
    .eq('id', 2)

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Successfully linked "À monter" action type to the "Montee" field.')
  }
}

updateActionType()
