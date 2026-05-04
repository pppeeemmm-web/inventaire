
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fixProductionLocations() {
  console.log('--- PURGING PRODUCTION GHOSTS ---')
  
  // Rule: If StageProduction is NOT 'available', location MUST be 13 (Pem Atelier)
  // We exclude 'archive' works if they have a different logic.
  
  const { data, error } = await supabase
    .from('Oeuvres')
    .update({ 
      LocalisationID: 13,
      ContactID: 13 // Force owner back to PEM too for production works
    })
    .not('StageProduction', 'eq', 'available')
    .not('StageProduction', 'eq', 'archive')
    .not('StageProduction', 'is', null)

  if (error) {
    console.error('Update failed:', error.message)
  } else {
    console.log('Update successful. All production works are now at the Atelier.')
  }
}

fixProductionLocations()
