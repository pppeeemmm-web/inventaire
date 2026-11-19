'use server'

// Collector share kit — team actions (TODO 11b, Pem build GO 2026-11-18).
// Design: docs/design/2026-11-18/Collector_ShareKit.notes.md. Any team member may make a kit (Pem answer 2).
// A kit = one Contact + a frozen list of public works (answer 8) + a private link /c/<token> + a PDF in the Vault.
// The app sends nothing: the team copies / shares the link through their own channel.

import { createHash } from 'crypto'
import { nanoid } from 'nanoid'
import { revalidatePath } from 'next/cache'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@/lib/supabase/server'
import { thumbUrl, yearOf } from '@/lib/data'
import { logError } from '@/lib/error-reporter/server'
import { recordStorageObject } from '@/lib/storage-object-ledger'
import { compareContactsByName, contactListLabel } from '@/lib/contacts/contact-display'
import { PRESET_DEFAULTS } from '@/lib/portfolio-pdf-types'
import { generatePortfolioPdf } from '@/app/atelier/(portal)/portfolio/pdf-action'
import {
  KIT_DEFAULT_DAYS,
  KIT_MAX_WORKS,
  KIT_MESSAGE_MAX,
  KIT_TOKEN_LENGTH,
  kitContactName,
  kitPriceFromWork,
  kitSize,
  type KitContactHit,
  type KitDraft,
  type KitDraftWork,
  type KitGroupHit,
  type KitLang,
  type KitSource,
  type KitSummary,
} from '@/lib/collector-kit'

type Supa = Awaited<ReturnType<typeof createClient>>

async function guardTeam(): Promise<{ supabase: Supa; userId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'forbidden' }
  return { supabase, userId: user.id }
}

const WORK_COLS = 'OeuvreID, Titre, "Année", Hauteur, Largeur, Profondeur, txtImageNameLink, Prix, PrixFinal, tva_rate, statusId, is_public, deleted_at'

type WorkRow = {
  OeuvreID: number
  Titre: string | null
  Année: string | null
  Hauteur: string | null
  Largeur: string | null
  Profondeur: string | null
  txtImageNameLink: string | null
  Prix: number | null
  PrixFinal: number | null
  tva_rate: number | null
  statusId: number | null
  is_public: boolean | null
  deleted_at: string | null
}

function draftWork(o: WorkRow): KitDraftWork {
  return {
    oeuvreId: o.OeuvreID,
    title: o.Titre,
    year: yearOf(o.Année),
    size: kitSize(o),
    thumb: thumbUrl(o.txtImageNameLink),
    isPublic: Boolean(o.is_public) && !o.deleted_at,
    price: kitPriceFromWork(o),
    statusId: o.statusId,
  }
}

async function worksByIds(supabase: Supa, ids: number[]): Promise<WorkRow[]> {
  if (!ids.length) return []
  const { data } = await supabase.from('Oeuvres').select(WORK_COLS).in('OeuvreID', ids)
  const byId = new Map(((data ?? []) as unknown as WorkRow[]).map((r) => [r.OeuvreID, r]))
  return ids.map((id) => byId.get(id)).filter((r): r is WorkRow => Boolean(r))
}

async function groupWorkIds(supabase: Supa, groupId: string): Promise<{ name: string | null; ids: number[] }> {
  const [{ data: g }, { data: rows }] = await Promise.all([
    supabase.from('working_group').select('name').eq('id', groupId).maybeSingle(),
    supabase.from('working_group_work').select('oeuvre_id, position').eq('group_id', groupId).order('position'),
  ])
  return { name: g?.name ?? null, ids: (rows ?? []).map((r) => r.oeuvre_id) }
}

/** Works for the sheet, in the group's (or selection's) order. Private works come back with isPublic false. */
export async function loadKitDraft(source: KitSource): Promise<KitDraft | { error: string }> {
  const g = await guardTeam()
  if ('error' in g) return g
  if (source.kind === 'contact') return { groupName: null, works: [] }
  if (source.kind === 'group') {
    const { name, ids } = await groupWorkIds(g.supabase, source.groupId)
    return { groupName: name, works: (await worksByIds(g.supabase, ids)).map(draftWork) }
  }
  const ids = [...new Set(source.oeuvreIds.filter((n) => Number.isInteger(n)))].slice(0, 400)
  return { groupName: null, works: (await worksByIds(g.supabase, ids)).map(draftWork) }
}

/** Working groups for the sheet opened from a contact card (pick what to offer). */
export async function listKitGroups(): Promise<KitGroupHit[]> {
  const g = await guardTeam()
  if ('error' in g) return []
  const [{ data: groups }, { data: links }] = await Promise.all([
    g.supabase.from('working_group').select('id, name').is('archived_at', null),
    g.supabase.from('working_group_work').select('group_id'),
  ])
  const count = new Map<string, number>()
  for (const l of links ?? []) count.set(l.group_id, (count.get(l.group_id) ?? 0) + 1)
  return (groups ?? [])
    .map((x) => ({ id: x.id, name: x.name, count: count.get(x.id) ?? 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

/** Collector picker: search Contacts by name / institution / email. */
export async function searchKitContacts(q: string): Promise<KitContactHit[]> {
  const g = await guardTeam()
  if ('error' in g) return []
  const term = q.trim().replace(/[%,()]/g, ' ').trim()
  if (term.length < 2) return []
  const like = `%${term}%`
  const { data } = await g.supabase
    .from('Contact')
    .select('ContactID, "Prénom", Nom, NomInstitution, Email, Ville')
    .or(`Nom.ilike.${like},"Prénom".ilike.${like},NomInstitution.ilike.${like},Email.ilike.${like}`)
    .limit(12)
  // Picker: `DUPONT Marie` (institution in the hint), sorted by family name.
  return [...(data ?? [])]
    .sort(compareContactsByName())
    .map((c) => ({
      contactId: c.ContactID,
      name: contactListLabel(c, { institution: 'none', fallback: '' }) || c.Email || `#${c.ContactID}`,
      hint: [c.NomInstitution && kitContactName({ ...c, NomInstitution: null }) ? c.NomInstitution : null, c.Ville]
        .filter(Boolean).join(' · ') || null,
    }))
}

export async function getKitContact(contactId: number): Promise<KitContactHit | null> {
  const g = await guardTeam()
  if ('error' in g) return null
  const { data: c } = await g.supabase
    .from('Contact').select('ContactID, "Prénom", Nom, NomInstitution, Email, Ville').eq('ContactID', contactId).maybeSingle()
  if (!c) return null
  return { contactId: c.ContactID, name: contactListLabel(c, { institution: 'none', fallback: '' }) || c.Email || `#${c.ContactID}`, hint: c.Ville ?? null }
}

// ── PDF in the Vault ─────────────────────────────────────────────────────────────────────────────────────────

const VAULT_BUCKET = process.env.R2_VAULT_BUCKET ?? 'vault'

function vaultS3() {
  const accountId = process.env.R2_ACCOUNT_ID ?? ''
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
}

/**
 * Make the kit's PDF with the portfolio engine (preset « collectionneur », the kit's works in order) and store it
 * in the private Vault bucket under `kits/<token>/<hash8>.pdf`. Served only through /c/<token>/pdf.
 * The engine is unchanged (Pem answer 8): public works only, no prices printed.
 */
async function makeKitPdf(supabase: Supa, token: string, lang: KitLang, workIds: number[]): Promise<{ ok: true } | { error: string }> {
  const res = await generatePortfolioPdf({
    ...PRESET_DEFAULTS.collectionneur,
    maxWorks: KIT_MAX_WORKS,
    lang,
    format: 'a4p',
    collectionFilter: null,
    workSequence: workIds,
  })
  if ('error' in res) return { error: res.error }
  const body = Buffer.from(res.base64, 'base64')
  const hash8 = createHash('sha256').update(body).digest('hex').slice(0, 8)
  const key = `kits/${token}/${hash8}.pdf`
  try {
    await vaultS3().send(new PutObjectCommand({ Bucket: VAULT_BUCKET, Key: key, Body: body, ContentType: 'application/pdf' }))
    await recordStorageObject({
      bucket: VAULT_BUCKET,
      objectKey: key,
      sizeBytes: body.length,
      contentType: 'application/pdf',
      source: 'collector_kit_pdf',
      classification: 'linked',
      linkedRefs: [{ table: 'private_link', column: 'pdf_key', row_id: token }],
    })
  } catch (e) {
    await logError('Collector kit PDF not stored', e, { source: 'kits.makeKitPdf', metadata: { token } })
    return { error: String(e) }
  }
  const { error } = await supabase
    .from('private_link').update({ pdf_key: key, pdf_made_at: new Date().toISOString() }).eq('token', token)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── Create ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface CreateKitInput {
  contactId: number
  groupId: string | null
  works: { oeuvreId: number; showPrice: boolean }[]
  lang: KitLang
  message: string
  /** YYYY-MM-DD, the last day the link works (Paris end of day). */
  validUntil: string
}

export type CreateKitResult =
  | { ok: true; token: string; expiresAt: string; workCount: number; contactName: string; pdfError: string | null }
  | { error: string }

function endOfDayIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const d = new Date(`${day}T23:59:59+01:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export async function createCollectorKit(input: CreateKitInput): Promise<CreateKitResult> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { supabase, userId } = g

  const lang: KitLang = input.lang === 'en' ? 'en' : 'fr'
  const message = input.message.trim().slice(0, KIT_MESSAGE_MAX) || null
  const expiresAt = endOfDayIso(input.validUntil)
  if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) return { error: 'bad_date' }

  const { data: contact } = await supabase
    .from('Contact').select('ContactID, "Prénom", Nom, NomInstitution, Email').eq('ContactID', input.contactId).maybeSingle()
  if (!contact) return { error: 'no_contact' }
  const contactName = kitContactName(contact) || contact.Email || `#${contact.ContactID}`

  // Keep order, drop duplicates, re-read the works: only public ones may go in (Pem answer 8).
  const seen = new Set<number>()
  const wanted = input.works.filter((w) => Number.isInteger(w.oeuvreId) && !seen.has(w.oeuvreId) && seen.add(w.oeuvreId))
  if (!wanted.length) return { error: 'no_works' }
  if (wanted.length > KIT_MAX_WORKS) return { error: 'too_many' }
  const rows = await worksByIds(supabase, wanted.map((w) => w.oeuvreId))
  const byId = new Map(rows.map((r) => [r.OeuvreID, r]))
  const lines = wanted.flatMap((w) => {
    const r = byId.get(w.oeuvreId)
    if (!r || !r.is_public || r.deleted_at) return []
    const price = w.showPrice ? kitPriceFromWork(r) : null
    return [{ oeuvreId: w.oeuvreId, showPrice: price != null, price }]
  })
  if (lines.length !== wanted.length) return { error: 'not_public' }

  const token = nanoid(KIT_TOKEN_LENGTH)
  const { error: eLink } = await supabase.from('private_link').insert({
    token,
    contact_id: contact.ContactID,
    recipient_name: contactName,
    group_id: input.groupId,
    lang,
    message,
    expires_at: expiresAt,
    created_by: userId,
  })
  if (eLink) return { error: eLink.message }

  const { error: eWorks } = await supabase.from('private_link_work').insert(
    lines.map((l, i) => ({ token, oeuvre_id: l.oeuvreId, position: i, show_price: l.showPrice, price: l.price })),
  )
  if (eWorks) {
    await supabase.from('private_link').delete().eq('token', token)
    return { error: eWorks.message }
  }

  const pdf = await makeKitPdf(supabase, token, lang, lines.map((l) => l.oeuvreId))
  revalidatePath('/atelier/contacts')
  return {
    ok: true,
    token,
    expiresAt,
    workCount: lines.length,
    contactName,
    pdfError: 'error' in pdf ? pdf.error : null,
  }
}

// ── Kits on the contact card ─────────────────────────────────────────────────────────────────────────────────

export async function listContactKits(contactId: number): Promise<KitSummary[] | { error: string }> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { data: links, error } = await g.supabase
    .from('private_link')
    .select('token, group_id, lang, created_at, expires_at, revoked_at, view_count, first_opened_at, last_opened_at, pdf_made_at, pdf_downloads, working_group(name)')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
  if (error) return { error: error.message }
  const tokens = (links ?? []).map((l) => l.token)
  if (!tokens.length) return []
  const [{ data: works }, { data: enquiries }] = await Promise.all([
    g.supabase.from('private_link_work').select('token').in('token', tokens),
    g.supabase.from('inquiry').select('private_link_token').in('private_link_token', tokens),
  ])
  const nWorks = new Map<string, number>()
  for (const w of works ?? []) nWorks.set(w.token, (nWorks.get(w.token) ?? 0) + 1)
  const nEnq = new Map<string, number>()
  for (const e of enquiries ?? []) if (e.private_link_token) nEnq.set(e.private_link_token, (nEnq.get(e.private_link_token) ?? 0) + 1)
  return (links ?? []).map((l) => ({
    token: l.token,
    groupName: (l.working_group as unknown as { name: string } | null)?.name ?? null,
    workCount: nWorks.get(l.token) ?? 0,
    lang: l.lang === 'en' ? 'en' : 'fr',
    createdAt: l.created_at,
    expiresAt: l.expires_at,
    revokedAt: l.revoked_at,
    viewCount: l.view_count,
    firstOpenedAt: l.first_opened_at,
    lastOpenedAt: l.last_opened_at,
    pdfMadeAt: l.pdf_made_at,
    pdfDownloads: l.pdf_downloads,
    enquiryCount: nEnq.get(l.token) ?? 0,
  }))
}

/** « Prolonger »: same link, new end date (default +14 days from today, or from the current end if later). */
export async function prolongKit(token: string, days = KIT_DEFAULT_DAYS): Promise<{ ok: true; expiresAt: string } | { error: string }> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { data: k } = await g.supabase.from('private_link').select('expires_at, revoked_at').eq('token', token).maybeSingle()
  if (!k) return { error: 'not_found' }
  if (k.revoked_at) return { error: 'revoked' }
  const from = Math.max(Date.now(), k.expires_at ? new Date(k.expires_at).getTime() : 0)
  const expiresAt = new Date(from + Math.max(1, Math.min(days, 365)) * 86_400_000).toISOString()
  const { error } = await g.supabase.from('private_link').update({ expires_at: expiresAt }).eq('token', token)
  if (error) return { error: error.message }
  return { ok: true, expiresAt }
}

/** « Retirer le lien »: the page and the PDF stop at once. A PDF already downloaded stays with the person. */
export async function revokeKit(token: string): Promise<{ ok: true; revokedAt: string } | { error: string }> {
  const g = await guardTeam()
  if ('error' in g) return g
  const revokedAt = new Date().toISOString()
  const { error } = await g.supabase.from('private_link').update({ revoked_at: revokedAt }).eq('token', token).is('revoked_at', null)
  if (error) return { error: error.message }
  return { ok: true, revokedAt }
}

/** « Refaire le PDF » (e.g. the first try failed, or a photo changed). Same works, same order. */
export async function remakeKitPdf(token: string): Promise<{ ok: true } | { error: string }> {
  const g = await guardTeam()
  if ('error' in g) return g
  const [{ data: k }, { data: works }] = await Promise.all([
    g.supabase.from('private_link').select('lang, revoked_at').eq('token', token).maybeSingle(),
    g.supabase.from('private_link_work').select('oeuvre_id, position').eq('token', token).order('position'),
  ])
  if (!k) return { error: 'not_found' }
  if (k.revoked_at) return { error: 'revoked' }
  return makeKitPdf(g.supabase, token, k.lang === 'en' ? 'en' : 'fr', (works ?? []).map((w) => w.oeuvre_id))
}
