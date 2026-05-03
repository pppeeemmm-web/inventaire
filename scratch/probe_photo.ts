
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

async function probe() {
  const { data, count, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, statusId, NeedsPhotograph, is_public', { count: 'exact' })
    .eq('NeedsPhotograph', true)

  if (error) { console.error(error); return }
  console.log(`Total works with NeedsPhotograph=true: ${count}`)
  console.log('Sample:', data?.slice(0, 5))
}

probe()
