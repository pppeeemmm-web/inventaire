
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
  console.log('Auditing database for workflow contradictions...')
  
  // 1. Get PEM contact ID
  const { data: contacts } = await supabase.from('Contacts').select('ContactID, NomInstitution, Nom')
  const pem = contacts?.find(c => c.NomInstitution === 'Pem' || c.Nom === 'Pem')
  const pemId = pem?.ContactID
  console.log(`PEM ID detected: ${pemId}`)

  // 2. Audit Stage vs Custodian
  const { data: works, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, statusId, NeedsPhotograph, is_public, LocalisationID')

  if (error) { console.error(error); return }

  const contradictions: any[] = []

  works.forEach(o => {
    const isAtelier = o.statusId === 1 || o.statusId === 7 // Catalogué or Atelier (I need to check IDs)
    // Rule: Catalogued/Atelier => Custodian must be PEM
    if (isAtelier && o.LocalisationID && o.LocalisationID !== pemId) {
      contradictions.push({ ...o, reason: 'In Cataloguing/Atelier but custodian is not Artist' })
    }
    // Rule: Available/Public => NeedsPhotograph must be false
    if ((o.statusId === 2 || o.is_public === true) && o.NeedsPhotograph === true) {
      contradictions.push({ ...o, reason: 'Available/Public but Needs Photograph' })
    }
  })

  console.log(`\nAudit results: ${contradictions.length} contradictions found.`)
  contradictions.forEach(c => {
    console.log(`- #${c.OeuvreID} "${c.Titre}": ${c.reason} (StatusID=${c.statusId}, CustodianID=${c.LocalisationID})`)
  })

  if (contradictions.length > 0) {
    console.log('\nSuggested SQL Cleanup:')
    console.log(`-- Fix photography contradictions\nUPDATE "Oeuvres" SET "statusId" = 1, "is_public" = false WHERE "NeedsPhotograph" = true AND ("statusId" = 2 OR "is_public" = true);\n`)
    console.log(`-- Fix custodian contradictions (move back to PEM)\nUPDATE "Oeuvres" SET "LocalisationID" = ${pemId} WHERE ("statusId" = 1 OR "statusId" = 7) AND "LocalisationID" != ${pemId};`)
  }
}

audit()
