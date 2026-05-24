import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/supabase.generated'

type TypedSupabase = SupabaseClient<Database>

/** Narrow untyped browser/server clients to generated schema for suivi tables. */
export function asTypedSupabase(sb: unknown): TypedSupabase {
  return sb as TypedSupabase
}

export function fromSuiviProcess(sb: unknown) {
  return asTypedSupabase(sb).from('suivi_process')
}

export function fromSuiviEtape(sb: unknown) {
  return asTypedSupabase(sb).from('suivi_etape')
}
