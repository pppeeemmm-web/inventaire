import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function audit() {
  console.log('Auditing Oeuvres for photography/status contradictions...')
  
  // Rule: NeedsPhotograph=true => statusId != 2 and is_public != true
  const { data, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, statusId, NeedsPhotograph, is_public')
    .or('NeedsPhotograph.eq.true,NeedsPhotograph.eq.1')

  if (error) {
    console.error('Error fetching data:', error)
    return
  }

  const contradictions = data.filter(o => 
    (o.statusId === 2 || o.is_public === true)
  )

  if (contradictions.length === 0) {
    console.log('No contradictions found.')
    return
  }

  console.log(`Found ${contradictions.length} contradictions:`)
  contradictions.forEach(o => {
    console.log(`- #${o.OeuvreID} "${o.Titre}": status=${o.statusId}, public=${o.is_public}, needsPhoto=${o.NeedsPhotograph}`)
  })

  console.log('\nSuggested fixes:')
  console.log('UPDATE "Oeuvres" SET "statusId" = 1, "is_public" = false WHERE "NeedsPhotograph" = true AND ("statusId" = 2 OR "is_public" = true);')
}

audit()
