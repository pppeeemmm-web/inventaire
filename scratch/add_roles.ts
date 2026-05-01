import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mcrzsxrcoexnlwmaunte.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4'

async function addRoles() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const rolesToAdd = [
    { Nom: 'Client' },
    { Nom: 'Prospect' },
    { Nom: 'Restaurateur' },
    { Nom: 'Expert' },
    { Nom: 'Conseiller' },
    { Nom: 'Courtier' },
    { Nom: 'Assureur' },
    { Nom: 'Collaborateur' }
  ]

  const { error } = await supabase
    .from('tblRole')
    .insert(rolesToAdd)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Successfully added missing roles.')
}

addRoles()
