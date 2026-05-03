
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

async function updateConstraint() {
  const sql = `
    ALTER TABLE "Oeuvres" DROP CONSTRAINT IF EXISTS "Oeuvres_StageProduction_check";
    ALTER TABLE "Oeuvres" ADD CONSTRAINT "Oeuvres_StageProduction_check" 
    CHECK ("StageProduction" IN ('atelier', 'wip', 'shot', 'catalogued', 'available', 'archive', 'idea', 'drying', 'mounting', 'framing'));
  `
  
  // Try to use a dedicated RPC for SQL if available, or just a direct update if we have a table for it
  // Since we don't have a generic run_sql RPC by default in many Supabase projects,
  // we might need to do this through the UI or a specific script.
  // I'll try to find if there's a migration folder.
  
  console.log('Running SQL update...')
  const { data, error } = await supabase.rpc('run_sql', { sql })
  
  if (error) {
    console.error('SQL Error:', error)
    console.log('\n--- MANUAL SQL ACTION REQUIRED ---')
    console.log('Please run this in your Supabase SQL Editor:')
    console.log(sql)
  } else {
    console.log('Success!')
  }
}

updateConstraint()
