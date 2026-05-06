import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://mcrzsxrcoexnlwmaunte.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4'
)

async function check() {
  const { data, error } = await supabase.from('Oeuvres')
    .select('OeuvreID, Titre, is_public')
    .eq('is_public', true)
  
  if (error) {
    console.error(error)
  } else {
    console.log(`Found ${data.length} public works:`)
    data.forEach(w => console.log(`- ${w.OeuvreID}: ${w.Titre}`))
  }
}

check()
