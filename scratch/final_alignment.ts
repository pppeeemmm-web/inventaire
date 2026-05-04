
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function finalCleanup() {
  console.log('--- FINAL DATA ALIGNMENT: STAGE + STATUS ---')
  
  // 1. Force StageProduction to 'atelier' for any work at PEM Atelier (13) 
  // that is currently marked as 'available' in the production column.
  const { error: e1 } = await supabase
    .from('Oeuvres')
    .update({ 
      StageProduction: 'atelier',
      commercial_status: 'private',
      statusId: 1
    })
    .eq('LocalisationID', 13)
    .eq('StageProduction', 'available')

  // 2. Also catch cases where StageProduction is null but they are in the Atelier
  const { error: e2 } = await supabase
    .from('Oeuvres')
    .update({ 
      StageProduction: 'atelier'
    })
    .eq('LocalisationID', 13)
    .is('StageProduction', null)

  if (e1 || e2) console.error('Update error:', e1?.message || e2?.message)
  else console.log('Database alignment complete. Stage and Status are now synchronized.')
}

finalCleanup()
