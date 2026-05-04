
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function purgeDisponibleFromProduction() {
  console.log('--- PURGING DISPONIBLE FROM PRODUCTION ---')
  
  // Rule: If StageProduction is NOT 'available', statusId MUST be 1 (Atelier)
  // And commercial_status MUST be 'private'
  
  const { data, error } = await supabase
    .from('Oeuvres')
    .update({ 
      statusId: 1,
      commercial_status: 'private'
    })
    .not('StageProduction', 'eq', 'available')
    .not('StageProduction', 'eq', 'archive')
    .not('StageProduction', 'is', null)

  if (error) {
    console.error('Update failed:', error.message)
  } else {
    console.log('Update successful. No more production works are marked as available.')
  }
}

purgeDisponibleFromProduction()
