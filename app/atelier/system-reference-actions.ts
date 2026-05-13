'use server'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { createClient } from '@/lib/supabase/server'

const REF_FILENAME = 'SYSTEM_LEDGER.md'

async function guardTeam(): Promise<{ error: 'Non authentifié' | 'Accès refusé' | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' }
  return { error: null }
}

/** Markdown reference for the System Ledger tab (repo `docs/SYSTEM_LEDGER.md`). */
export async function getSystemLedgerReferenceMarkdown(): Promise<
  { error: string } | { ok: true; markdown: string; filename: string }
> {
  const { error: authErr } = await guardTeam()
  if (authErr) return { error: authErr }
  const abs = path.join(process.cwd(), 'docs', REF_FILENAME)
  try {
    const markdown = await readFile(abs, 'utf8')
    return { ok: true, markdown, filename: REF_FILENAME }
  } catch (e) {
    return { error: `Reference MD: ${String(e)}` }
  }
}
