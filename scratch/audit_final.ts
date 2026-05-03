
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const lines = env.split('\n')
const envMap: Record<string, string> = {}
lines.forEach(line => {
  const parts = line.split('=')
  if (parts.length === 2) {
    envMap[parts[0].trim()] = parts[1].trim().replace(/^["']|["']$/g, '')
  }
})

const supabaseUrl = envMap['NEXT_PUBLIC_SUPABASE_URL']
const supabaseKey = envMap['NEXT_PUBLIC_SUPABASE_ANON_KEY']
const supabase = createClient(supabaseUrl, supabaseKey)

async function audit() {
  const pemId = 13 // Hardcoded from InventoryTab.tsx
  console.log(`Auditing with PEM_ID: ${pemId}`)

  const { data: works, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, statusId, NeedsPhotograph, is_public, LocalisationID')

  if (error) { console.error(error); return }

  const photoContradictions = works.filter(o => 
    (o.statusId === 2 || o.is_public === true) && o.NeedsPhotograph === true
  )

  const logisticsContradictions = works.filter(o => 
    (o.statusId === 1 || o.statusId === 7) && o.LocalisationID && o.LocalisationID !== pemId
  )

  console.log(`- Photo Contradictions: ${photoContradictions.length}`)
  console.log(`- Logistics Contradictions: ${logisticsContradictions.length}`)

  if (logisticsContradictions.length > 0) {
    console.log('\nLogistics contradictions:')
    logisticsContradictions.forEach(c => {
       console.log(`- #${c.OeuvreID} "${c.Titre}": statusId=${c.statusId}, CustodianID=${c.LocalisationID}`)
    })
  }
}

audit()
