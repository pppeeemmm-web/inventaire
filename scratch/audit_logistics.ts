
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const lines = env.split('\n')
const envMap: Record<string, string> = {}
lines.forEach(line => {
  const parts = line.split('=')
  if (parts.length === 2) {
    envMap[parts[0].trim()] = parts[1].trim()
  }
})

const supabaseUrl = envMap['NEXT_PUBLIC_SUPABASE_URL']
const supabaseKey = envMap['NEXT_PUBLIC_SUPABASE_ANON_KEY']
const supabase = createClient(supabaseUrl, supabaseKey)

async function auditLogistics() {
  console.log('Auditing logistics vs production...')
  
  // We need to fetch all works and check their combinations
  // statusId (Production): 1=Catalogué, 2=Available, 3=Archive (Wait, I need to check the IDs)
  // ownStage is likely not in the DB, it's derived.
  // Actually, let's look at the actual columns: statusId, ContactID, LocalisationID.
  
  const { data, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, statusId, ContactID, LocalisationID')

  if (error) { console.error(error); return }

  // Logic: 
  // statusId=1 (Catalogué) -> LocalisationID must be PEM (Artist)
  // statusId=2 (Available) -> Can be anything
  
  // Wait, I need the PEM contact ID.
  const { data: pem } = await supabase.from('Contacts').select('ContactID').eq('NomInstitution', 'Pem').single()
  const pemId = pem?.ContactID

  const contradictions = data.filter(o => 
    o.statusId === 1 && o.LocalisationID && o.LocalisationID !== pemId
  )

  console.log(`Found ${contradictions.length} logistics contradictions (Catalogué but not in Atelier):`)
  contradictions.slice(0, 10).forEach(o => {
    console.log(`- #${o.OeuvreID} "${o.Titre}": statusId=${o.statusId}, CustodianID=${o.LocalisationID}`)
  })
}

auditLogistics()
