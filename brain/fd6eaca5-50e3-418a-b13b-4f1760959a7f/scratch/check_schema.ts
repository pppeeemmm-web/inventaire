import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function check() {
  const { data, error } = await supabase
    .from('system_log')
    .select('*')
    .limit(1)
  
  if (error) {
    console.error("SCHEMA ERROR:", error)
  } else {
    console.log("COLUMNS:", Object.keys(data[0] || {}))
  }
}

check()
