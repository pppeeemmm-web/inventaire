import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mcrzsxrcoexnlwmaunte.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4'

async function updateAndCheck() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // 1. Rename WIP to Atelier
  const { error: err1 } = await supabase
    .from('OeuvreStatus')
    .update({ label: 'Atelier' })
    .eq('id', 1)

  if (err1) console.error('Error updating status:', err1)
  else console.log('Successfully renamed WIP to Atelier.')

  // 2. Check contact 13
  const { data: contact, error: err2 } = await supabase
    .from('Contact')
    .select('*')
    .eq('ContactID', 13)
    .single()

  if (err2) console.error('Error fetching contact 13:', err2)
  else console.log('Contact 13 is:', contact.Nom, contact.Prénom)
}

updateAndCheck()
