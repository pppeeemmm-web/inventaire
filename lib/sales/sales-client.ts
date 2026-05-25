import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/supabase.generated'
import { asTypedSupabase } from '@/lib/pipeline/suivi-client'

export { fromDocument, fromOeuvres, fromTechnique, fromSupport } from '@/lib/vault/vault-client'

/** Columns/tables present in DB but not yet in supabase.generated. */
type SaleOrderExtra = {
  consignment_order_id: string | null
  commission_amount: number | null
  updated_at: string | null
}

type ConsignmentExtra = {
  commission_pct: number | null
}

export type PaymentDbRow = {
  id: string
  order_id: string
  amount: number
  payment_date: string
  method: string | null
  notes: string | null
  created_at: string
}

type SalesTables = Omit<Database['public']['Tables'], 'sale_order' | 'consignment_order'> & {
  sale_order: {
    Row: Database['public']['Tables']['sale_order']['Row'] & SaleOrderExtra
    Insert: Database['public']['Tables']['sale_order']['Insert'] & Partial<SaleOrderExtra>
    Update: Database['public']['Tables']['sale_order']['Update'] & Partial<SaleOrderExtra>
    Relationships: Database['public']['Tables']['sale_order']['Relationships']
  }
  consignment_order: {
    Row: Database['public']['Tables']['consignment_order']['Row'] & ConsignmentExtra
    Insert: Database['public']['Tables']['consignment_order']['Insert'] & Partial<ConsignmentExtra>
    Update: Database['public']['Tables']['consignment_order']['Update'] & Partial<ConsignmentExtra>
    Relationships: Database['public']['Tables']['consignment_order']['Relationships']
  }
  payments: {
    Row: PaymentDbRow
    Insert: {
      order_id: string
      amount: number
      payment_date?: string
      method?: string | null
      notes?: string | null
      id?: string
      created_at?: string
    }
    Update: Partial<PaymentDbRow>
    Relationships: []
  }
}

type SalesDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & { Tables: SalesTables }
}

type SalesSupabase = SupabaseClient<SalesDatabase>

function asSalesSupabase(sb: unknown): SalesSupabase {
  return asTypedSupabase(sb) as SalesSupabase
}

export type SaleOrderDbRow = SalesTables['sale_order']['Row']
export type SaleOrderDbUpdate = SalesTables['sale_order']['Update']

export type ReturnWindowOrderRow = Pick<
  SaleOrderDbRow,
  | 'id'
  | 'statut'
  | 'notes'
  | 'oeuvre_id'
  | 'delivered'
  | 'return_window_days'
  | 'return_window_starts_at'
  | 'return_window_skipped'
>

export type ContactBriefRow = Pick<
  Database['public']['Tables']['Contact']['Row'],
  'Nom' | 'Prénom' | 'NomInstitution' | 'Ville' | 'Pays'
>

export type ConsignmentBriefRow = Pick<
  SalesTables['consignment_order']['Row'],
  'commission_pct' | 'order_ref' | 'partner_id'
>

export function fromSaleOrder(sb: unknown) {
  return asSalesSupabase(sb).from('sale_order')
}

export function fromConsignmentOrder(sb: unknown) {
  return asSalesSupabase(sb).from('consignment_order')
}

export function fromPayments(sb: unknown) {
  return asSalesSupabase(sb).from('payments')
}

export function fromContact(sb: unknown) {
  return asTypedSupabase(sb).from('Contact')
}

export function contactDisplayName(buyer: ContactBriefRow | null): string {
  if (!buyer) return 'N/A'
  return buyer.NomInstitution
    || `${buyer.Prénom ?? ''} ${buyer.Nom ?? ''}`.trim()
    || 'N/A'
}

export function contactLocation(buyer: ContactBriefRow | null): string {
  if (!buyer) return ''
  return [buyer.Ville, buyer.Pays].filter(Boolean).join(', ')
}
