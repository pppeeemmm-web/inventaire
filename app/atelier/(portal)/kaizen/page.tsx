import { redirect } from 'next/navigation'

/**
 * Kaizen « Création » moved to Idées (R1, Pem 2026-11-18; data: supabase/sql/kaizen_creation_to_ideas.sql).
 * Old links keep working: `?whatsnew=1` and `?view=website|business|review|system` → Opérations & Stratégie, anything else → Idées.
 */
export default async function KaizenCreationRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const v = Array.isArray(sp.view) ? sp.view[0] : sp.view
  // The What's new panel lives in the Kaizen header, on Opérations & Stratégie now.
  if (sp.whatsnew === '1') redirect('/atelier/kaizen-ops?whatsnew=1')
  if (v === 'website' || v === 'business' || v === 'review' || v === 'system') redirect(`/atelier/kaizen-ops?view=${v === 'system' ? 'website' : v}`)
  redirect('/atelier/concepts')
}
