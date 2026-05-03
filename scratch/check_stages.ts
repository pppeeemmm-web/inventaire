
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
const supabaseKey = envMap['SUPABASE_SERVICE_ROLE_KEY'] // Use service role to check system tables
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkConstraint() {
  // Query information_schema to find the check constraint
  const { data, error } = await supabase.rpc('get_check_constraints', { t_name: 'Oeuvres' })
  
  if (error) {
    // If RPC fails, try a direct query on pg_constraint
    const { data: direct, error: e2 } = await supabase.rpc('run_sql', { 
      sql: "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = '\"Oeuvres\"'::regclass AND contype = 'c';"
    })
    console.log('Constraint definition:', direct)
  } else {
    console.log('Constraints:', data)
  }
}

async function listDistinct() {
    const { data } = await supabase.from('Oeuvres').select('StageProduction')
    const stages = new Set(data?.map(o => o.StageProduction))
    console.log('Distinct StageProduction in DB:', Array.from(stages))
}

listDistinct()
