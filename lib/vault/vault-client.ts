import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/supabase.generated'

type TypedSupabase = SupabaseClient<Database>

export type DocumentRow = Database['public']['Tables']['document']['Row']

export function asTypedSupabase(sb: unknown): TypedSupabase {
  return sb as TypedSupabase
}

/** App VaultDoc still uses numeric ids in places; DB column is string. */
export function documentId(id: number | string): string {
  return String(id)
}

export function fromDocument(sb: unknown) {
  return asTypedSupabase(sb).from('document')
}

export function fromProfiles(sb: unknown) {
  return asTypedSupabase(sb).from('profiles')
}

export function fromOeuvres(sb: unknown) {
  return asTypedSupabase(sb).from('Oeuvres')
}

export function fromTechnique(sb: unknown) {
  return asTypedSupabase(sb).from('Technique')
}

export function fromSupport(sb: unknown) {
  return asTypedSupabase(sb).from('Support')
}
