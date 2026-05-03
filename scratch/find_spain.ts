
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

async function findSpain() {
  console.log('Searching for works or contacts in Spain...')
  
  // 1. Find contacts in Spain
  const { data: contacts } = await supabase
    .from('Contact')
    .select('ContactID, NomInstitution, Ville, Pays')
    .ilike('Pays', '%Espagne%')

  if (!contacts || contacts.length === 0) {
    // Try "Spain"
    const { data: contactsEn } = await supabase
      .from('Contact')
      .select('ContactID, NomInstitution, Ville, Pays')
      .ilike('Pays', '%Spain%')
    
    if (contactsEn) contacts?.push(...contactsEn)
  }

  console.log('Contacts in Spain:', contacts)

  if (contacts && contacts.length > 0) {
    const ids = contacts.map(c => c.ContactID)
    const { data: works } = await supabase
      .from('Oeuvres')
      .select('OeuvreID, Titre, statusId, LocalisationID, ContactID')
      .or(`LocalisationID.in.(${ids.join(',')}),ContactID.in.(${ids.join(',')})`)
    
    console.log('Works associated with Spanish contacts:', works)
  }

  // 2. Search LocalisationDetail for "Spain" or "Espagne"
  const { data: worksDetail } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, LocalisationDetail')
    .or('LocalisationDetail.ilike.%Spain%,LocalisationDetail.ilike.%Espagne%')
  
  console.log('Works with "Spain" in Detail:', worksDetail)
}

findSpain()
