
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const getEnv = (key: string) => {
  const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return match ? match[1].trim() : null
}

async function checkOrders() {
  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase config')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data, error } = await supabase
    .from('sale_order')
    .select('id, order_ref, pdf_path, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error fetching orders:', error)
    return
  }

  console.log('Recent Orders:', JSON.stringify(data, null, 2))
}

checkOrders()
