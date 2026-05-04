import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function align() {
  console.log("Starting Database Alignment...")

  // 1. Fix "Catalogued but Available" Gate Jumpers
  // These should be Status 1 (Atelier) and Location 13 (PEM)
  const { data: gateJumpers, error: e1 } = await supabase
    .from('Oeuvres')
    .select('OeuvreID')
    .eq('Catalogué', true)
    .eq('statusId', 2)

  if (e1) console.error("Fetch Gate Jumpers Error:", e1)
  
  if (gateJumpers && gateJumpers.length > 0) {
    const ids = gateJumpers.map(o => o.OeuvreID)
    console.log(`Fixing ${ids.length} Gate Jumpers:`, ids.join(', '))
    const { error: u1 } = await supabase
      .from('Oeuvres')
      .update({ statusId: 1, LocalisationID: 13, commercial_status: 'private' })
      .in('OeuvreID', ids)
    if (u1) console.error("Update Gate Jumpers Error:", u1)
    else console.log("Gate Jumpers aligned to Atelier/Private.")
  }

  // 2. Fix Production not at PEM
  const prodStages = ['wip', 'atelier', 'catalogued', 'shot']
  const { data: wrongLoc, error: e2 } = await supabase
    .from('Oeuvres')
    .select('OeuvreID')
    .in('StageProduction', prodStages)
    .neq('LocalisationID', 13)

  if (e2) console.error("Fetch Wrong Location Error:", e2)

  if (wrongLoc && wrongLoc.length > 0) {
    const ids = wrongLoc.map(o => o.OeuvreID)
    console.log(`Fixing ${ids.length} Production Location errors:`, ids.join(', '))
    const { error: u2 } = await supabase
      .from('Oeuvres')
      .update({ LocalisationID: 13 })
      .in('OeuvreID', ids)
    if (u2) console.error("Update Location Error:", u2)
    else console.log("Production locations aligned to PEM.")
  }

  console.log("\nDatabase Alignment Complete.")
}

align()
