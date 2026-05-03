
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
const supabaseKey = envMap['SUPABASE_SERVICE_ROLE_KEY']
const supabase = createClient(supabaseUrl, supabaseKey)

async function harmonize() {
  console.log('Starting Global Database Harmonization...')
  
  // 1. Get Status Map
  const { data: statusRows } = await supabase.from('OeuvreStatus').select('id, label')
  const statusMap: Record<number, string> = {}
  statusRows?.forEach(s => statusMap[s.id] = s.label)

  // 2. Fetch all works
  const { data: works, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, statusId, NeedsPhotograph, is_public')

  if (error) { console.error(error); return }

  console.log(`Analyzing ${works.length} works...`)

  const toCatalogued: number[] = []
  const toAvailable: number[] = []
  const toArchive: number[] = []

  works.forEach(o => {
    const statusLabel = o.statusId ? statusMap[o.statusId] : 'Atelier'
    
    if (o.NeedsPhotograph === true) {
      toCatalogued.push(o.OeuvreID)
    } else {
      // Has photo
      const isArchived = ['Sold', 'Gift', 'Consigned', 'Loan', 'Borrowed', 'Destroyed', 'Lost'].includes(statusLabel)
      if (isArchived) {
        toArchive.push(o.OeuvreID)
      } else {
        toAvailable.push(o.OeuvreID)
      }
    }
  })

  console.log(`Plan:`)
  console.log(`- Move to 'catalogued' (Needs Photo): ${toCatalogued.length}`)
  console.log(`- Move to 'available'  (Has Photo, in Studio): ${toAvailable.length}`)
  console.log(`- Move to 'archive'    (Has Photo, Transferred): ${toArchive.length}`)

  // 3. Execute Updates in batches
  if (toCatalogued.length > 0) {
    await supabase.from('Oeuvres').update({ StageProduction: 'catalogued' }).in('OeuvreID', toCatalogued)
  }
  if (toAvailable.length > 0) {
    await supabase.from('Oeuvres').update({ StageProduction: 'available', is_public: true }).in('OeuvreID', toAvailable)
  }
  if (toArchive.length > 0) {
    await supabase.from('Oeuvres').update({ StageProduction: 'archive' }).in('OeuvreID', toArchive)
  }

  console.log('Harmonization complete! The database now follows the new professional workflow logic.')
}

harmonize()
