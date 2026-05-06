import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function check() {
  const { data: oeuvre, error } = await supabase
    .from('Oeuvres')
    .select('*')
    .eq('OeuvreID', 2341)
    .single()

  if (error) {
    console.error(error)
    return
  }
  console.log("--- OEUVRE 2341 ---")
  console.log(JSON.stringify(oeuvre, null, 2))

  // Also check related contact if exists
  if (oeuvre.ContactID) {
    const { data: contact } = await supabase.from('Contact').select('*').eq('ContactID', oeuvre.ContactID).single()
    console.log("\n--- CONTACT ---")
    console.log(JSON.stringify(contact, null, 2))
  }
}

check()
