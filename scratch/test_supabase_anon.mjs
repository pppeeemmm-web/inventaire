
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const envFile = fs.readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const [key, ...rest] = line.split('=')
      return [key.trim(), rest.join('=').trim()]
    })
)

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function testConnection() {
  console.log('Testing connection with ANON KEY to:', supabaseUrl)
  const supabase = createClient(supabaseUrl, anonKey)
  
  const { data, error } = await supabase.from('Oeuvres').select('OeuvreID').limit(1)
  
  if (error) {
    console.error('Connection failed with ANON KEY:', error.message)
    console.error('Full error:', JSON.stringify(error, null, 2))
  } else {
    console.log('ANON KEY Connection successful! Data:', data)
  }
}

testConnection()
