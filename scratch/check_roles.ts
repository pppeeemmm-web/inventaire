import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function checkRoles() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('tblRole')
    .select('*')
    .order('Nom')

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Roles in tblRole:', data)
}

checkRoles()
