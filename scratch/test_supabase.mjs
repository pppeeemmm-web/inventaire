
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
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY

async function testConnection() {
  console.log('Testing connection to:', supabaseUrl)
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  const { data, error } = await supabase.from('Oeuvres').select('OeuvreID').limit(1)
  
  if (error) {
    console.error('Connection failed:', error.message)
    console.error('Full error:', JSON.stringify(error, null, 2))
  } else {
    console.log('Connection successful! Data:', data)
  }
}

testConnection()
