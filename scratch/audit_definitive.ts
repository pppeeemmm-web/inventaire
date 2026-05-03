
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
  
  // 1. Get correct table names and PEM ID
  // Based on app/atelier/page.tsx:
  // - Contacts are in 'Contact'
  // - Statuses are in 'OeuvreStatus' (fields: id, label)
  
  const { data: contacts } = await supabase.from('Contact').select('ContactID, NomInstitution, Nom')
  const pem = contacts?.find(c => c.NomInstitution === 'Pem' || c.Nom === 'Pem')
  const pemId = pem?.ContactID ?? 13 // Fallback to 13 from InventoryTab.tsx
  console.log(`PEM ID: ${pemId}`)

  const { data: statusRows } = await supabase.from('OeuvreStatus').select('id, label')
  const statusMap: Record<number, string> = {}
  statusRows?.forEach(s => statusMap[s.id] = s.label)
  console.log('Status Map:', statusMap)

  // 2. Audit
  const { data: works, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, statusId, NeedsPhotograph, is_public, LocalisationID')

  if (error) { console.error(error); return }

  const contradictions: any[] = []

  works.forEach(o => {
    const statusLabel = o.statusId ? statusMap[o.statusId] : ''
    const isReady = statusLabel === 'Available' || o.is_public === true
    const isWIP   = statusLabel === 'WIP' || statusLabel === 'Catalogué' || statusLabel === 'Atelier'
    
    // Rule: Ready but needs photo
    if (isReady && o.NeedsPhotograph === true) {
      contradictions.push({ ...o, label: statusLabel, reason: 'Available/Public but Needs Photo' })
    }
    // Rule: Not Ready but out of studio
    if (isWIP && o.LocalisationID && o.LocalisationID !== pemId) {
      contradictions.push({ ...o, label: statusLabel, reason: 'In WIP/Cataloguing but not in Atelier' })
    }
  })

  console.log(`\nAudit results: ${contradictions.length} contradictions found.`)
  contradictions.forEach(c => {
    console.log(`- #${c.OeuvreID} "${c.Titre}": ${c.reason} (Status=${c.label}, CustodianID=${c.LocalisationID})`)
  })
}

audit()
