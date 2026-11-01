'use server'

// Concept documents — Vault `document` rows linked to a concept (supabase/sql/document_concept_links.sql).
// Files upload through the Vault actions (uploadDocument / createVaultUploadUrl + finalizeVaultUpload);
// this module adds links and local mentions, and attaches existing Vault documents.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { fromDocument } from '@/lib/vault/vault-client'
import { resolveVaultFolder } from '@/lib/vault/folder-routing'

export interface ConceptDocument {
  id:             string
  concept_id:     string | null
  name:           string
  kind:           string | null
  source:         'file' | 'link' | 'local'
  storage_path:   string | null
  external_url:   string | null
  local_location: string | null
  file_size:      number | null
  mime_type:      string | null
  notes:          string | null
  created_at:     string
}

type Result<T = object> = { error: string } | ({ ok: true } & T)

const COLUMNS =
  'id, concept_id, name, kind, source, storage_path, external_url, local_location, file_size, mime_type, notes, created_at'

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' as const, supabase: null }
  return { error: null, supabase }
}

function asConceptDocument(row: Record<string, unknown>): ConceptDocument {
  const source = row.source === 'link' || row.source === 'local' ? row.source : 'file'
  return { ...(row as unknown as ConceptDocument), source }
}

/** Every document attached to some concept — one query for the whole Concepts tab. */
export async function fetchConceptDocuments(): Promise<ConceptDocument[]> {
  const { error, supabase } = await guardTeam()
  if (error || !supabase) return []
  const { data } = await fromDocument(supabase)
    .select(COLUMNS)
    .not('concept_id', 'is', null)
    .order('created_at', { ascending: false })
  return (data ?? []).map((r) => asConceptDocument(r as Record<string, unknown>))
}

/** Vault documents not yet attached to a concept, for "attach from the Vault". */
export async function fetchAttachableDocuments(): Promise<ConceptDocument[]> {
  const { error, supabase } = await guardTeam()
  if (error || !supabase) return []
  const { data } = await fromDocument(supabase)
    .select(COLUMNS)
    .is('concept_id', null)
    .order('name', { ascending: true })
    .limit(500)
  return (data ?? []).map((r) => asConceptDocument(r as Record<string, unknown>))
}

/**
 * Add a link (Drive, Proton, web) or a local mention ("PC atelier — C:\…") to a concept.
 * Nothing is stored in R2; the database constraint checks the URL / location shape.
 */
export async function addConceptDocumentReference(input: {
  conceptId: string
  source: 'link' | 'local'
  name: string
  value: string
  notes?: string | null
}): Promise<Result<{ doc: ConceptDocument }>> {
  const { error, supabase } = await guardTeam()
  if (error || !supabase) return { error: error ?? 'Auth' }

  const value = input.value.trim()
  if (!value) return { error: input.source === 'link' ? 'Lien requis' : 'Emplacement requis' }
  if (input.source === 'link' && !/^https?:\/\//i.test(value)) {
    return { error: 'Le lien doit commencer par https:// (un chemin local va dans « Emplacement local »)' }
  }
  const name = input.name.trim() || value.split(/[\\/]/).filter(Boolean).pop() || value
  const notes = input.notes?.trim() || null
  const kind = input.source === 'link' ? 'lien' : 'local'

  const { data, error: dbErr } = await fromDocument(supabase)
    .insert({
      name,
      kind,
      notes,
      source: input.source,
      external_url: input.source === 'link' ? value : null,
      local_location: input.source === 'local' ? value : null,
      concept_id: input.conceptId,
      folder: resolveVaultFolder({ kind, notes, storage_path: null, name }),
    })
    .select(COLUMNS)
    .single()
  if (dbErr || !data) return { error: dbErr?.message ?? 'Insert failed' }
  revalidatePath('/atelier/concepts')
  return { ok: true, doc: asConceptDocument(data as Record<string, unknown>) }
}

/** Attach an existing Vault document to a concept, or detach it (conceptId null). The document stays in the Vault. */
export async function setDocumentConcept(docId: string, conceptId: string | null): Promise<Result> {
  const { error, supabase } = await guardTeam()
  if (error || !supabase) return { error: error ?? 'Auth' }
  const { error: dbErr } = await fromDocument(supabase).update({ concept_id: conceptId }).eq('id', docId)
  if (dbErr) return { error: dbErr.message }
  revalidatePath('/atelier/concepts')
  return { ok: true }
}
