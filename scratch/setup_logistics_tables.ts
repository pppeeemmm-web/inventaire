
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

async function setupTables() {
  const sql = `
    -- Consignment Orders
    CREATE TABLE IF NOT EXISTS "consignment_order" (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz DEFAULT now(),
      oeuvre_id integer REFERENCES "Oeuvres"("OeuvreID"),
      partner_id integer REFERENCES "Contact"("ContactID"),
      start_date date,
      end_date date,
      insurance_value numeric,
      catalog_price numeric,
      status text DEFAULT 'draft',
      order_ref text,
      pdf_path text,
      notes text
    );

    -- Shipments (Logistics)
    CREATE TABLE IF NOT EXISTS "shipment" (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz DEFAULT now(),
      to_contact_id integer REFERENCES "Contact"("ContactID"),
      kind text, -- 'sale', 'consignment', 'return', 'exhibition'
      scheduled_for date,
      shipped_at date,
      delivered_at date,
      status text DEFAULT 'packed',
      note text,
      order_id uuid -- can link to sale_order or consignment_order
    );

    CREATE TABLE IF NOT EXISTS "shipment_work" (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      shipment_id uuid REFERENCES "shipment"(id) ON DELETE CASCADE,
      oeuvre_id integer REFERENCES "Oeuvres"("OeuvreID")
    );
  `
  
  console.log('Attempting to create missing tables...')
  const { error } = await supabase.rpc('run_sql', { sql })
  
  if (error) {
    console.error('SQL Error:', error)
    console.log('\n--- MANUAL SQL ACTION REQUIRED ---')
    console.log('Please run this in your Supabase SQL Editor to unblock the Pipeline/Logistics tabs:')
    console.log(sql)
  } else {
    console.log('Success! All tables created.')
  }
}

setupTables()
