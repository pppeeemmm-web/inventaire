import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function check() {
  const { data: types, error: e1 } = await supabase.from('work_action_type').select('*').order('sort_order')
  const { data: work, error: e2 } = await supabase.from('Oeuvres').select('Titre, statusId, Catalogué').eq('OeuvreID', 2331).single()
  
  console.log("COLUMNS:", types)
  console.log("WORK 2331 STATE:", work)
}

check()
