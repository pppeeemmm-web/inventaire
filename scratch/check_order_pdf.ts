
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

async function checkOrder() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await supabase
    .from('sale_order')
    .select('*')
    .eq('order_ref', 'PEM-2026-001')
    .single()

  if (error) {
    console.error('Error fetching order:', error)
    return
  }

  console.log('Order Details:', JSON.stringify(data, null, 2))
}

checkOrder()
