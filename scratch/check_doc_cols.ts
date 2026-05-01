
import { createClient } from '@supabase/supabase-js'

async function check() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase.rpc('is_team')
  console.log('Test RPC:', { data, error })

  // Try to see if we can get column info via a query
  const { data: cols, error: err } = await supabase.from('document').select('*').limit(1)
  console.log('Current Document Columns:', Object.keys(data?.[0] || {}))
}

check()
