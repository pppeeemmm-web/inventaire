
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
  console.log('Final Database Integrity Audit...')
  
  const { data: contacts } = await supabase.from('Contact').select('ContactID, NomInstitution, Nom')
  const pem = contacts?.find(c => c.NomInstitution === 'Pem' || c.Nom === 'Pem')
  const pemId = pem?.ContactID ?? 13
  console.log(`PEM ID: ${pemId}`)

  const { data: statusRows } = await supabase.from('OeuvreStatus').select('id, label')
  const statusMap: Record<number, string> = {}
  statusRows?.forEach(s => statusMap[s.id] = s.label)

  const { data: works, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, statusId, NeedsPhotograph, is_public, LocalisationID')

  if (error) { console.error(error); return }

  const contradictions: any[] = []

  works.forEach(o => {
    const statusLabel = o.statusId ? statusMap[o.statusId] : 'Unknown'
    
    // Rule A: Public works MUST NOT need a photo
    if (o.is_public === true && o.NeedsPhotograph === true) {
      contradictions.push({ ...o, label: statusLabel, reason: 'Live/Public but Needs Photograph' })
    }

    // Rule B: Consigned or Sold works MUST NOT need a photo
    const isTransferred = ['Consigned', 'Sold', 'Gift', 'Loan', 'Borrowed'].includes(statusLabel)
    if (isTransferred && o.NeedsPhotograph === true) {
      contradictions.push({ ...o, label: statusLabel, reason: `Work is ${statusLabel} but Needs Photograph` })
    }

    // Rule C: Atelier/WIP works MUST BE physically at PEM's studio
    const isWIP = ['Atelier', 'WIP', 'Catalogué'].includes(statusLabel)
    if (isWIP && o.LocalisationID && o.LocalisationID !== pemId) {
      contradictions.push({ ...o, label: statusLabel, reason: 'Atelier/WIP work is physically elsewhere' })
    }

    // Rule D: Consigned works MUST NOT have PEM as Custodian (LocalisationID)
    if (statusLabel === 'Consigned' && o.LocalisationID === pemId) {
      contradictions.push({ ...o, label: statusLabel, reason: 'Consigned but physically in Atelier' })
    }
  })

  console.log(`\nAudit Complete: ${contradictions.length} contradictions found.`)
  contradictions.forEach(c => {
    console.log(`- #${c.OeuvreID} "${c.Titre}": ${c.reason} (Status=${c.label}, CustodianID=${c.LocalisationID})`)
  })
}

audit()
