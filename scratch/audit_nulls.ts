
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

async function auditNulls() {
  const { data: dataTrue, count: countTrue } = await supabase.from('Oeuvres').select('*', { count: 'exact', head: true }).eq('NeedsPhotograph', true)
  const { data: dataFalse, count: countFalse } = await supabase.from('Oeuvres').select('*', { count: 'exact', head: true }).eq('NeedsPhotograph', false)
  const { data: dataNull, count: countNull } = await supabase.from('Oeuvres').select('*', { count: 'exact', head: true }).is('NeedsPhotograph', null)

  console.log(`NeedsPhotograph Distribution:`)
  console.log(`- True:  ${countTrue}`)
  console.log(`- False: ${countFalse}`)
  console.log(`- Null:  ${countNull}`)
}

auditNulls()
