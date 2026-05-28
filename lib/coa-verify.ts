/**
 * Server-only COA verification (uses service role to read `document` + `Oeuvres`).
 * Must only be imported from Server Components / Route Handlers.
 */
import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import type { CoaVerifyOutcome } from '@/lib/types/coa-verify'

export type { CoaVerifyOutcome } from '@/lib/types/coa-verify'

/** Matches generateCOA in app/atelier/vault/actions.ts */
const CERT_ID_RE = /^PEM-(\d+)-[A-Z0-9]+$/

function recomputeCertHash(params: {
  certId: string
  oeuvreId: number
  titre: string
  année: string
  techLabel: string
  dims: string | null
}): string {
  const dims = params.dims ?? ''
  const hashData = `${params.certId}|${params.oeuvreId}|${params.titre}|${params.année}|${params.techLabel}|${dims}`
  return createHash('sha256').update(hashData).digest('hex')
}

export async function verifyCoaByCertId(rawCertId: string): Promise<CoaVerifyOutcome> {
  const certId = decodeURIComponent(rawCertId || '').trim()
  if (!CERT_ID_RE.test(certId)) {
    return { ok: false, reason: 'invalid_id' }
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, reason: 'config' }
  }

  const supabase = createServiceClient()

  const { data: doc, error: docErr } = await supabase.from('document')
    .select('id, cert_id, cert_hash, oeuvre_id, created_at')
    .eq('kind', 'coa')
    .eq('cert_id', certId)
    .maybeSingle()

  if (docErr || !doc?.cert_hash || doc.oeuvre_id == null) {
    return { ok: false, reason: 'not_found' }
  }

  const { data: o, error: oErr } = await supabase.from('Oeuvres')
    .select('OeuvreID, Titre, "Année", Technique, Support, Hauteur, Largeur, Profondeur')
    .eq('OeuvreID', doc.oeuvre_id)
    .single()

  if (oErr || !o) {
    return { ok: false, reason: 'not_found' }
  }

  const [{ data: techRow }, { data: suppRow }] = await Promise.all([
    o.Technique
      ? supabase.from('Technique').select('Technique').eq('TechniqueID', o.Technique).single()
      : Promise.resolve({ data: null }),
    o.Support
      ? supabase.from('Support').select('Support').eq('SupportID', o.Support).single()
      : Promise.resolve({ data: null }),
  ])

  const techLabel = (techRow as { Technique: string } | null)?.Technique ?? ''
  const dims =
    o.Hauteur && o.Largeur
      ? `${o.Hauteur} × ${o.Largeur}${o.Profondeur ? ` × ${o.Profondeur}` : ''} cm`
      : null

  const expected = recomputeCertHash({
    certId,
    oeuvreId: o.OeuvreID,
    titre: o.Titre ?? '',
    année: o.Année ?? '',
    techLabel,
    dims,
  })

  if (expected !== doc.cert_hash) {
    return { ok: false, reason: 'tampered' }
  }

  const anneeDisplay = o.Année ? String(o.Année).slice(0, 4) : '—'
  return {
    ok: true,
    certId,
    oeuvreId: o.OeuvreID,
    titre: o.Titre?.trim() || '—',
    anneeDisplay,
    issuedAt: doc.created_at as string,
  }
}
