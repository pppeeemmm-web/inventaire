import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://mcrzsxrcoexnlwmaunte.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4'
)

async function fix() {
  // Create "Cataloguer" task for 2331 since it was manually "Done" before automation was fixed
  const { data, error } = await supabase.from('work_action').insert({
    oeuvre_id: 2331,
    action_type_id: 9, // Cataloguer
    done: false
  })
  
  if (error) console.error("FIX ERROR:", error)
  else console.log("FIX SUCCESS: Work 2331 moved to Cataloguer stage.")
}

fix()
