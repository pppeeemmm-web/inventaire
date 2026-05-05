import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://mcrzsxrcoexnlwmaunte.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4'
)

async function check() {
  const { data: types, error: e1 } = await supabase.from('work_action_type').select('*').order('sort_order')
  const { data: work, error: e2 } = await supabase.from('Oeuvres').select('Titre, statusId, Catalogué').eq('OeuvreID', 2331).single()
  const { data: actions, error: e3 } = await supabase.from('work_action').select('*').eq('oeuvre_id', 2331)
  
  console.log("COLUMNS:", JSON.stringify(types, null, 2))
  console.log("WORK 2331 STATE:", work)
  console.log("WORK 2331 ACTIONS:", actions)
}

check()
