
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Manual env parsing
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

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function audit() {
  console.log('Auditing Oeuvres for photography/status contradictions...')
  
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
  contradictions.slice(0, 20).forEach(o => {
    console.log(`- #${o.OeuvreID} "${o.Titre}": status=${o.statusId}, public=${o.is_public}, needsPhoto=${o.NeedsPhotograph}`)
  })
  if (contradictions.length > 20) console.log('... and more.')

  console.log('\nSuggested SQL fix:')
  console.log('UPDATE "Oeuvres" SET "statusId" = 1, "is_public" = false WHERE "NeedsPhotograph" = true AND ("statusId" = 2 OR "is_public" = true);')
}

audit()
