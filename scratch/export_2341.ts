import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function run() {
  const { data, error } = await supabase
    .from('Oeuvres')
    .select('*')
    .eq('OeuvreID', 2341)
    .single()

  if (error || !data) {
    console.error(error)
    return
  }

  const header = Object.keys(data).join(';')
  const values = Object.values(data).map(v => {
    if (v === null) return ''
    const str = String(v)
    return '"' + str.replace(/"/g, '""') + '"'
  }).join(';')

  fs.writeFileSync('scratch/work_2341.csv', header + '\n' + values, 'utf-8')
  console.log("CSV generated at scratch/work_2341.csv")
}

run()
