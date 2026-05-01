import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { error } = await supabase.rpc('run_sql', { sql: `
    ALTER TABLE concept ADD COLUMN IF NOT EXISTS category text DEFAULT 'artistic';
  `})
  if (error) console.error(error)
  else console.log('Category column added.')
}

main()
