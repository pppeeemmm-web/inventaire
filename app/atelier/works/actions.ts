'use server'

// Server Actions for work creation and editing.
// Called from WorkForm (client component) via useTransition.

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/supabase.generated'
import { seqFromFilename, STATUS_ID_ARCHIVE_ARTISTE, STATUS_IDS_PUBLIC } from '@/lib/data'
import { makeImageStorageFilename, validateWorkImageBuffer } from '@/lib/image-upload'
import { pendingPayloadFromFormData } from '@/lib/work-pending-keys'
import type { WorkImage, Oeuvre } from '@/lib/types/database'
import crypto from 'crypto'
import sharp from 'sharp'
import { logError } from '@/lib/error-reporter/server'
import { logSystemEvent } from '@/lib/utils/logging'
import {
  historiqueLinesForOeuvreUpdate,
  mergeHistoriqueLines,
} from '@/lib/oeuvre-historique'
import { r2S3Hostname } from '@/lib/r2-s3-host'
import { markStorageObject, recordStorageObject } from '@/lib/storage-object-ledger'

/** Returns null if caller is admin, else error string. Use for hard-destructive ops. */
async function requireAdmin(supabase: SupabaseClient): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'Non authentifié'
  const { data: isAdmin } = await supabase.rpc('is_admin')
  return isAdmin ? null : 'Action réservée à l’administrateur'
}

const GRAPH_JUNCTION_MIGRATION_HINT =
  'Exécuter supabase/sql/graph_foundation/05c_graph_sync_safe_insert.sql dans l’éditeur SQL Supabase (ou `pwsh scripts/apply-graph-05c.ps1` avec SUPABASE_DB_URL).'

function junctionRpcErrorMessage(err: { message?: string; code?: string }): string {
  const msg = err.message ?? ''
  if (
    err.code === '42883' ||
    /replace_oeuvre_(themes|work_groups)/i.test(msg) && /does not exist|Could not find/i.test(msg)
  ) {
    return GRAPH_JUNCTION_MIGRATION_HINT
  }
  if (/ON CONFLICT/i.test(msg)) {
    return `${msg} — ${GRAPH_JUNCTION_MIGRATION_HINT}`
  }
  return msg
}

async function replaceOeuvreThemes(
  svc: SupabaseClient,
  oeuvreId: number,
  themeIds: number[],
): Promise<{ ok: true } | { error: string }> {
  const { error } = await svc.rpc('replace_oeuvre_themes', {
    p_oeuvre_id: oeuvreId,
    p_theme_ids: themeIds,
  })
  if (error) return { error: junctionRpcErrorMessage(error) }
  return { ok: true }
}

async function replaceOeuvreWorkGroups(
  svc: SupabaseClient,
  oeuvreId: number,
  groupIds: string[],
): Promise<{ ok: true } | { error: string }> {
  const { error } = await svc.rpc('replace_oeuvre_work_groups', {
    p_oeuvre_id: oeuvreId,
    p_group_ids: groupIds,
  })
  if (error) return { error: junctionRpcErrorMessage(error) }
  return { ok: true }
}

async function syncPipelineWithBooleans(
  supabase: SupabaseClient<Database>,
  oid: number,
  flags: { catalogued: boolean; needsPhotograph: boolean }
): Promise<{ error: string } | { ok: true }> {
  const setAction = async (actionId: number, state: 'done' | 'pending' | 'remove'): Promise<{ error: string } | { ok: true }> => {
    if (state === 'remove') {
      const { error } = await supabase.from('work_action').delete().eq('oeuvre_id', oid).eq('action_type_id', actionId)
      if (error) return { error: error.message }
      return { ok: true }
    }
    const isDone = state === 'done'
    const { data: existing, error: selErr } = await supabase
      .from('work_action')
      .select('id, done')
      .eq('oeuvre_id', oid)
      .eq('action_type_id', actionId)
      .maybeSingle()
    if (selErr) return { error: selErr.message }

    if (existing) {
      if (existing.done !== isDone) {
        const { error } = await supabase.from('work_action').update({ done: isDone }).eq('id', existing.id)
        if (error) return { error: error.message }
      }
    } else {
      const { error } = await supabase.from('work_action').insert({ oeuvre_id: oid, action_type_id: actionId, done: isDone })
      if (error) return { error: error.message }
    }
    return { ok: true }
  }

  // Action IDs: 6 = Photographier, 9 = Cataloguer
  const steps: Array<[number, 'done' | 'pending' | 'remove']> = !flags.catalogued
    ? [[9, 'pending'], [6, 'remove']]
    : flags.needsPhotograph
      ? [[9, 'done'], [6, 'pending']]
      : [[9, 'done'], [6, 'done']]  // "Disponible" (Catalogued + no photo needed)

  for (const [aId, state] of steps) {
    const r = await setAction(aId, state)
    if ('error' in r) return { error: `pipeline action ${aId}: ${r.error}` }
  }
  return { ok: true }
}

export type SaveResult   = { error: string } | { ok: true; newId?: number; pending?: boolean }
export type DeleteResult = { error: string } | { ok: true }
export type ImageResult  = { error: string } | { ok: true; image: WorkImage }
export type ImageReplaceResult = { error: string } | { ok: true; image: WorkImage; cacheKey: string }

/** Minimal snapshot for undo after save (status + pipeline booleans + junctions). */
export type WorkRevertSnapshot = {
  statusId: number | null
  catalogued: boolean
  needsPhotograph: boolean
  themeIds: number[]
  groupIds: string[]
}

/** Remove every tblImage row for these works and best-effort R2 objects (original + AVIF thumb). */
async function deleteAllImagesForOeuvres(
  supabase: SupabaseClient,
  oeuvreIds: number[],
): Promise<DeleteResult> {
  if (oeuvreIds.length === 0) return { ok: true }
  const { data: rows, error: selErr } = await supabase
    .from('tblImage')
    .select('txtImageNameLink')
    .in('OeuvreID', oeuvreIds)
  if (selErr) return { error: selErr.message }
  const { error: delErr } = await supabase.from('tblImage').delete().in('OeuvreID', oeuvreIds)
  if (delErr) return { error: delErr.message }
  for (const r of rows ?? []) {
    const filename = r.txtImageNameLink as string | null
    if (!filename) continue
    const thumbName = `thumbs/${filename.replace(/\.[^.]+$/, '')}.avif`
    try {
      await r2SoftDelete(filename)
    } catch (e) {
      console.warn('[works/actions] r2SoftDelete original', filename, e)
    }
    try {
      await r2SoftDelete(thumbName)
    } catch (e) {
      console.warn('[works/actions] r2SoftDelete thumb', thumbName, e)
    }
  }
  return { ok: true }
}

/** Permanent delete (R2 + DB). Admin only. Use after trash TTL or explicit purge. */
export async function purgeWorkPermanently(oid: number): Promise<DeleteResult> {
  const supabase = await createClient()
  const adminErr = await requireAdmin(supabase)
  if (adminErr) return { error: adminErr }
  const svc = createServiceClient()
  const { error: relErr } = await supabase.from('tblrelations').delete().or(`source_id.eq.${oid},target_id.eq.${oid}`)
  if (relErr) return { error: relErr.message }
  const { error: themeErr } = await svc.from('oeuvre_theme').delete().eq('oeuvre_id', oid)
  if (themeErr) return { error: themeErr.message }
  const imgDel = await deleteAllImagesForOeuvres(supabase, [oid])
  if ('error' in imgDel) return imgDel
  const { error } = await supabase.from('Oeuvres').delete().eq('OeuvreID', oid)
  if (error) return { error: error.message }
  revalidatePath('/atelier')
  return { ok: true }
}

/** Soft-delete: set `deleted_at` (requires column — see `supabase/sql/oeuvres_deleted_at.sql`). */
export async function deleteWork(oid: number): Promise<DeleteResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const ts = new Date().toISOString()
  const { error } = await supabase
    .from('Oeuvres')
    .update({ deleted_at: ts })
    .eq('OeuvreID', oid)
    .is('deleted_at', null)
  if (error) return { error: error.message }
  revalidatePath('/atelier')
  revalidatePath('/hub')
  revalidatePath('/works')
  return { ok: true }
}

export async function deleteSelectedWorks(ids: number[]): Promise<DeleteResult> {
  if (ids.length === 0) return { ok: true }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const ts = new Date().toISOString()
  const { error } = await supabase
    .from('Oeuvres')
    .update({ deleted_at: ts })
    .in('OeuvreID', ids)
    .is('deleted_at', null)
  if (error) return { error: error.message }
  revalidatePath('/atelier')
  revalidatePath('/hub')
  revalidatePath('/works')
  return { ok: true }
}

export async function restoreSoftDeletedWorks(ids: number[]): Promise<DeleteResult> {
  if (ids.length === 0) return { ok: true }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { error } = await supabase
    .from('Oeuvres')
    .update({ deleted_at: null })
    .in('OeuvreID', ids)
  if (error) return { error: error.message }
  revalidatePath('/atelier')
  revalidatePath('/hub')
  revalidatePath('/works')
  return { ok: true }
}

// ── Save (create or update) ───────────────────────────────────────────────

export async function saveWork(formData: FormData): Promise<SaveResult> {
  const supabase = await createClient()
  const svc = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // ── Parse scalar fields ──────────────────────────────────────────────
  const oeuvreIdRaw  = (formData.get('oeuvre_id') as string | null)?.trim()
  const isNew        = !oeuvreIdRaw

  // ── Editor approval gate (Phase B) ───────────────────────────────────
  // Non-admin team edits to existing works are queued for admin review.
  // New-work creation is allowed (low destructive risk; version trigger captures
  // future updates). The `__skip_review` flag is set by approvePending() when
  // the admin is replaying a previously-queued payload.
  const skipReview = formData.get('__skip_review') === '1'
  if (!isNew && !skipReview) {
    const { data: isAdmin } = await supabase.rpc('is_admin')
    if (!isAdmin) {
      const oid = Number(oeuvreIdRaw)
      const payload = pendingPayloadFromFormData(formData)
      // Existing-work saves always send themes/groups from the editor; empty = clear junction.
      payload.themes = (formData.getAll('themes') as string[])
        .map((s) => s.trim())
        .filter(Boolean)
        .join(',')
      payload.groups = (formData.getAll('groups') as string[])
        .map((s) => s.trim())
        .filter(Boolean)
        .join(',')
      const { data: baseline } = await supabase
        .from('Oeuvres').select('*').eq('OeuvreID', oid).maybeSingle()
      const { error: pErr } = await supabase.from('pending_changes').insert({
        oeuvre_id: oid,
        payload,
        baseline,
        author_id: user.id,
        author_email: user.email ?? null,
      })
      if (pErr) return { error: pErr.message }
      revalidatePath('/atelier/audit')
      return { ok: true, pending: true }
    }
  }

  const titre        = (formData.get('titre')   as string | null)?.trim() || null
  const année        = (formData.get('annee')   as string | null)?.trim() || null
  const techniqueId  = numOrNull(formData.get('technique'))
  const supportId    = numOrNull(formData.get('support'))
  const formatId     = numOrNull(formData.get('format'))
  const hauteur      = (formData.get('hauteur')     as string | null)?.trim() || null
  const largeur      = (formData.get('largeur')     as string | null)?.trim() || null
  const profondeur   = (formData.get('profondeur')  as string | null)?.trim() || null
  const prix         = numOrNull(formData.get('prix'))
  const discount     = numOrNull(formData.get('discount'))
  const prixFinal    = numOrNull(formData.get('prix_final'))
  const statusId     = numOrNull(formData.get('status_id'))
  const contactId    = numOrNull(formData.get('contact_id'))
  const commentaires      = (formData.get('commentaires')       as string | null)?.trim() || null
  const historique        = (formData.get('historique')         as string | null)?.trim() || null
  const localisationId    = numOrNull(formData.get('localisation_id'))
  const localisationDetail = (formData.get('localisation_detail') as string | null)?.trim() || null
  const tvaRate      = numOrNull(formData.get('tva_rate'))

  let exposable      = formData.get('exposable')     === '1'
  if (statusId === STATUS_ID_ARCHIVE_ARTISTE) exposable = false
  const broadcastReady = formData.get('broadcast_ready') === '1'
  const broadcastCaptionSeedRaw = (formData.get('broadcast_caption_seed') as string | null)?.trim() ?? ''
  const broadcastCaptionSeed = broadcastCaptionSeedRaw ? broadcastCaptionSeedRaw.slice(0, 2000) : null
  const montee       = formData.get('montee')      === '1'
  const encadree     = formData.get('encadree')      === '1'
  const catalogued   = formData.get('catalogued')    === '1'
  const isCommission   = formData.get('is_commission') === '1'
  const dateLivraison  = (formData.get('date_livraison') as string | null)?.trim() || null
  const needsPhotograph = formData.get('needs_photograph') === '1'
  const anonymityLevel = numOrNull(formData.get('anonymity_level')) ?? 0
  const adminOverrideAnonymity = formData.get('admin_override_anonymity') === '1'
  const isPaid         = formData.get('is_paid') === '1'
  const isGift         = formData.get('is_gift') === '1'
  const presentationId = numOrNull(formData.get('presentation_id'))

  const themeIds: number[] = (formData.getAll('themes') as string[])
    .map(Number)
    .filter((n) => n > 0)

  // ── Date fallback system ──
  // If year is just YYYY, convert to YYYY-01-01. If YYYY-MM, convert to YYYY-MM-01.
  let annéeFinal = année
  if (année && /^\d{4}$/.test(année)) {
    annéeFinal = `${année}-01-01`
  } else if (année && /^\d{4}-\d{2}$/.test(année)) {
    annéeFinal = `${année}-01`
  }

  // ── Image upload ─────────────────────────────────────────────────────
  const imageFile     = formData.get('image') as File | null
  const imageExisting = (formData.get('image_existing') as string | null)?.trim() || null
  let imageName       = imageExisting

  // ── Photography Gates ─────────────────────────────────────────────────────
  // Gate 1 — Catalogué: must have at least one image in tblImage.
  //   Images are managed via tblImage independently; query DB rather than form field.
  if (catalogued && !imageFile?.size) {
    let hasImage = false
    if (!isNew && oeuvreIdRaw) {
      const { count } = await supabase
        .from('tblImage')
        .select('ImageID', { count: 'exact', head: true })
        .eq('OeuvreID', parseInt(oeuvreIdRaw))
      hasImage = (count ?? 0) > 0
    }
    if (!hasImage) {
      return { error: 'Une œuvre ne peut pas être cataloguée sans photographie.' }
    }
  }

  // Gate 2 — Disponible (statusId 2): NeedsPhotograph must be unchecked.
  //   The artist/admin validates photo quality by unchecking NeedsPhotograph.
  if (statusId === 2 && needsPhotograph) {
    return { error: 'Décochez "Photo requise" pour confirmer la validation photo avant de passer en Disponible.' }
  }

  // ── Branch: new vs edit ───────────────────────────────────────────────

  if (isNew) {
    // Compute next OeuvreID (no sequence in DB)
    const { data: maxRow } = await supabase
      .from('Oeuvres')
      .select('OeuvreID')
      .order('OeuvreID', { ascending: false })
      .limit(1)
      .single()

    // Note: no DB sequence — race condition possible if two inserts run simultaneously.
    // Acceptable for single-artist studio usage. Mitigation: unique constraint on OeuvreID
    // will return a Postgres error which surfaces as insertErr below.
    const oid = (maxRow?.OeuvreID ?? 2337) + 1

    // Upload image if provided
    if (imageFile && imageFile.size > 0) {
      const uploadResult = await uploadImage(supabase, imageFile, oid, 1, user.id)
      if ('error' in uploadResult) return { error: uploadResult.error }
      imageName = uploadResult.filename
    }

    // Provenance seeding
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '/')
    const originEntry = `[${dateStr}] Atelier`
    const historiqueAppend = formData.get('historique_append') as string | null
    const initialHistorique = historiqueAppend
      ? `${originEntry}\n${historiqueAppend}`
      : originEntry

    // INSERT
    const { error: insertErr } = await supabase.from('Oeuvres').insert({
      OeuvreID:     oid,
      Titre:        titre,
      Année:        annéeFinal,
      Technique:    techniqueId,
      Support:      supportId,
      Format:       formatId,
      Hauteur:      hauteur,
      Largeur:      largeur,
      Profondeur:   profondeur,
      Prix:         prix,
      Discount:     discount,
      PrixFinal:    prixFinal,
      statusId:     statusId,
      ContactID:    contactId,
      Commentaires:      commentaires,
      Historique:        initialHistorique,
      LocalisationID:    localisationId,
      LocalisationDetail: localisationDetail,
      Exposable:         exposable,
      Montee:            montee,
      Encadree:          encadree,
      Catalogué:         catalogued,
      IsCommission:      isCommission,
      DateLivraison:     dateLivraison,
      NeedsPhotograph:   needsPhotograph,
      broadcast_ready:   broadcastReady,
      broadcast_caption_seed: broadcastCaptionSeed,
      anonymity_level:   anonymityLevel,
      admin_override_anonymity: adminOverrideAnonymity,
      tva_rate:          tvaRate,
      is_paid:           isPaid,
      is_gift:           isGift,
      PresentationID:  presentationId,
      txtImageNameLink:  imageName,
    })

    if (insertErr) return { error: insertErr.message }

    // Insert image into tblImage (canonical store) — ImageID omitted so the DB sequence handles it
    if (imageName) {
      const { error: imgErr } = await supabase.from('tblImage').insert({
        OeuvreID:         oid,
        txtImageNameLink: imageName,
        SeqNo:            1,
        DateAdded:        new Date().toISOString(),
      })
      if (imgErr) return { error: `tblImage: ${imgErr.message}` }
    }

    const themeRes = await replaceOeuvreThemes(svc, oid, themeIds)
    if ('error' in themeRes) return { error: themeRes.error }

    // Sync pipeline actions with production booleans
    const pipeRes = await syncPipelineWithBooleans(supabase, oid, { catalogued, needsPhotograph })
    if ('error' in pipeRes) return { error: pipeRes.error }

    revalidatePath('/atelier')
    revalidatePath(`/atelier/works/${oid}/edit`)
    return { ok: true, newId: oid }

  } else {
    const oid = parseInt(oeuvreIdRaw!, 10)
    if (isNaN(oid)) return { error: 'ID invalide' }

    // Fetch current record to compare statusId + ContactID for history
    type CurrentOeuvre = {
      statusId: number | null
      ContactID: number | null
      LocalisationID: number | null
      Prix: number | null
      PrixFinal: number | null
      Historique: string | null
      Catalogué: boolean | null
      NeedsPhotograph: boolean | null
      is_public: boolean | null
      anonymity_level: string | null
      admin_override_anonymity: boolean | null
    }

    const { data: current } = await supabase
      .from('Oeuvres')
      .select('statusId, ContactID, LocalisationID, Prix, PrixFinal, txtImageNameLink, Historique, "Catalogué", "NeedsPhotograph", is_public, anonymity_level, admin_override_anonymity')
      .eq('OeuvreID', oid)
      .single<CurrentOeuvre>()

    // User-edited base; server appends ownership / location lines when those fields change.
    let finalHistorique = historique ?? current?.Historique ?? ''
    if (current) {
      const autoLines = await historiqueLinesForOeuvreUpdate(
        supabase,
        {
          statusId: current.statusId,
          ContactID: current.ContactID,
          LocalisationID: current.LocalisationID,
        },
        {
          statusId: statusId ?? null,
          contactId: contactId ?? null,
          localisationId: localisationId ?? null,
        },
      )
      finalHistorique = mergeHistoriqueLines(finalHistorique, autoLines)
    }

    // Upload new image if provided via form (separate from ImageManager flow)
    let formUploadedNewImage = false
    if (imageFile && imageFile.size > 0) {
      const seq      = seqFromFilename(imageExisting)
      const uploadResult = await uploadImage(supabase, imageFile, oid, seq, user.id)
      if ('error' in uploadResult) return { error: uploadResult.error }
      imageName = uploadResult.filename
      formUploadedNewImage = true
    }

    const isGift       = formData.get('is_gift')       === '1'
    const paymentDone  = formData.get('payment_received') === '1'
    const isAnonymous  = formData.get('is_anonymous') === '1'

    // is_public is managed by DB trigger sync_is_public_from_status() — not set manually.
    const willBePublic =
      statusId != null && STATUS_IDS_PUBLIC.includes(statusId)

    // Build update payload.
    const updatePayload: Record<string, unknown> = {
      Titre:        titre,
      Année:        annéeFinal,
      Technique:    techniqueId,
      Support:      supportId,
      Format:       formatId,
      Hauteur:      hauteur,
      Largeur:      largeur,
      Profondeur:   profondeur,
      Prix:         prix,
      Discount:     discount,
      PrixFinal:    prixFinal,
      statusId:     statusId,
      ContactID:    contactId,
      Commentaires:      commentaires,
      Historique:        finalHistorique,
      LocalisationID:    localisationId,
      LocalisationDetail: localisationDetail,
      Exposable:         exposable,
      Montee:            montee,
      Encadree:          encadree,
      Catalogué:         catalogued,
      IsCommission:      isCommission,
      DateLivraison:     dateLivraison,
      NeedsPhotograph:   needsPhotograph,
      anonymity_level:   anonymityLevel,
      admin_override_anonymity: adminOverrideAnonymity,
      tva_rate:          tvaRate,
      is_paid:           isPaid,
      is_gift:           isGift,
      PresentationID:    presentationId,
      broadcast_ready:   broadcastReady,
      broadcast_caption_seed: broadcastCaptionSeed,
    }
    if (formUploadedNewImage) {
      updatePayload.txtImageNameLink = imageName
    }

    const { error: updateErr } = await supabase
      .from('Oeuvres')
      .update(updatePayload)
      .eq('OeuvreID', oid)
      .is('deleted_at', null)

    if (updateErr) return { error: updateErr.message }

    // ── Log Significant Event: Image Upload (form) ──
    if (formUploadedNewImage) {
      await logSystemEvent({
        eventType: 'VAULT_UPLOAD',
        tableName: 'Oeuvres',
        rowId: oid,
        newValue: imageName,
        metadata: { titre, source: 'work_form' },
      })
    }

    // ── Log Significant Event: Visibility Release ──
    if (willBePublic && (!current || !current.is_public)) {
      await logSystemEvent({
        eventType: 'VISIBILITY_GATE',
        tableName: 'Oeuvres',
        rowId: oid,
        newValue: 'PUBLIC',
        metadata: { titre, statusId }
      })
    }

    // ── Log Significant Event: Status Change ──
    if (current && statusId !== current.statusId) {
      await logSystemEvent({
        eventType: 'STATUS_CHANGE',
        tableName: 'Oeuvres',
        rowId: oid,
        oldValue: current.statusId,
        newValue: statusId,
        metadata: { titre }
      })
    }

    // ── Log Significant Event: Location Move ──
    if (current && localisationId !== current.LocalisationID) {
      await logSystemEvent({
        eventType: 'LOCATION_MOVE',
        tableName: 'Oeuvres',
        rowId: oid,
        oldValue: current.LocalisationID,
        newValue: localisationId,
        metadata: { titre },
      })
    }

    // ── Log Significant Event: Price Change ──
    if (current && (prixFinal !== current.PrixFinal || prix !== current.Prix)) {
      await logSystemEvent({
        eventType: 'PRICE_CHANGE',
        tableName: 'Oeuvres',
        rowId: oid,
        oldValue: { Prix: current.Prix, PrixFinal: current.PrixFinal },
        newValue: { Prix: prix, PrixFinal: prixFinal },
        metadata: { titre },
      })
    }

    // ── Log Significant Event: Admin Anonymity Override ──
    if (adminOverrideAnonymity && !current?.admin_override_anonymity) {
      await logSystemEvent({
        eventType: 'GATE_BYPASS',
        tableName: 'Oeuvres',
        rowId: oid,
        newValue: true,
        metadata: { titre, anonymity_level: anonymityLevel },
      })
    }

    // Sync pipeline actions with production booleans
    const pipeRes = await syncPipelineWithBooleans(supabase, oid, { catalogued, needsPhotograph })
    if ('error' in pipeRes) return { error: pipeRes.error }

    const themeRes = await replaceOeuvreThemes(svc, oid, themeIds)
    if ('error' in themeRes) return { error: themeRes.error }

    const groupIds = (formData.getAll('groups') as string[]).filter(Boolean)
    const groupRes = await replaceOeuvreWorkGroups(svc, oid, groupIds)
    if ('error' in groupRes) return { error: groupRes.error }

    revalidatePath('/atelier')
    return { ok: true }
  }
}

async function saveWorkGroups(
  supabase: SupabaseClient,
  oid: number,
  gids: string[],
): Promise<{ ok: true } | { error: string }> {
  return replaceOeuvreWorkGroups(supabase, oid, gids)
}

/** Restore status + pipeline flags + theme/group junctions to a prior snapshot. */
export async function revertWorkSnapshot(
  oeuvreId: number,
  snapshot: WorkRevertSnapshot,
): Promise<SaveResult> {
  const supabase = await createClient()
  const svc = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error: uErr } = await supabase
    .from('Oeuvres')
    .update({
      statusId: snapshot.statusId,
      Catalogué: snapshot.catalogued,
      NeedsPhotograph: snapshot.needsPhotograph,
    })
    .eq('OeuvreID', oeuvreId)
    .is('deleted_at', null)
  if (uErr) return { error: uErr.message }

  const pipeRes = await syncPipelineWithBooleans(supabase, oeuvreId, {
    catalogued: snapshot.catalogued,
    needsPhotograph: snapshot.needsPhotograph,
  })
  if ('error' in pipeRes) return { error: pipeRes.error }

  const themeRes = await replaceOeuvreThemes(svc, oeuvreId, snapshot.themeIds)
  if ('error' in themeRes) return { error: themeRes.error }

  const groupRes = await saveWorkGroups(svc, oeuvreId, snapshot.groupIds)
  if ('error' in groupRes) return { error: groupRes.error }

  revalidatePath('/atelier')
  revalidatePath(`/atelier/works/${oeuvreId}/edit`)
  return { ok: true }
}

export async function createLookup(table: string, name: string): Promise<{ id: number } | { error: string }> {
  const supabase = await createClient()
  const idField   = table === 'Technique' ? 'TechniqueID' : (table === 'Support' ? 'SupportID' : 'FormatID')
  const nameField = table === 'Technique' ? 'Technique' : (table === 'Support' ? 'Support' : 'Format')

  const { data: maxRow } = await supabase.from(table).select(idField).order(idField, { ascending: false }).limit(1).single()
  const nextId = (((maxRow as any)?.[idField] ?? 0) as number) + 1

  const { data, error } = await supabase.from(table).insert({ [idField]: nextId, [nameField]: name }).select().single()
  if (error) return { error: error.message }
  return { id: (data as any)[idField] }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function numOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// ── R2 upload helpers ─────────────────────────────────────────────────────────

function r2PutHeaders(
  buf: Buffer,
  filename: string,
  contentType: string,
): Record<string, string> {
  const account   = process.env.R2_ACCOUNT_ID ?? ''
  const accessKey = process.env.R2_ACCESS_KEY_ID!
  const secretKey = process.env.R2_SECRET_ACCESS_KEY!
  const bucket    = (process.env.R2_BUCKET ?? 'paintings').trim()
  const host       = r2S3Hostname(account)
  const pathname   = `/${bucket}/${filename.split('/').map(encodeURIComponent).join('/')}`

  const now       = new Date()
  const amzDate   = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const dateStamp = amzDate.slice(0, 8)
  const bodyHash  = crypto.createHash('sha256').update(buf).digest('hex')

  const headers: Record<string, string> = {
    'host':                  host,
    'content-type':          contentType,
    'content-length':        String(buf.length),
    'x-amz-date':           amzDate,
    'x-amz-content-sha256': bodyHash,
  }

  const sortedKeys       = Object.keys(headers).sort()
  const canonicalHeaders = sortedKeys.map(k => `${k}:${headers[k]}\n`).join('')
  const signedHeaderStr  = sortedKeys.join(';')
  const canonicalRequest = ['PUT', pathname, '', canonicalHeaders, signedHeaderStr, bodyHash].join('\n')

  const region    = 'auto'
  const service   = 's3'
  const credScope = `${dateStamp}/${region}/${service}/aws4_request`
  const strToSign = ['AWS4-HMAC-SHA256', amzDate, credScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n')

  const hmac = (key: Buffer | string, data: string) =>
    crypto.createHmac('sha256', key).update(data).digest()

  const sigKey = hmac(hmac(hmac(hmac('AWS4' + secretKey, dateStamp), region), service), 'aws4_request')
  const sig    = crypto.createHmac('sha256', sigKey).update(strToSign).digest('hex')

  headers['Authorization'] =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope}, SignedHeaders=${signedHeaderStr}, Signature=${sig}`

  return headers
}

async function r2Put(
  buf: Buffer,
  filename: string,
  contentType: string,
  ledger?: {
    source?: string
    classification?: 'linked' | 'unidentified' | 'transient' | 'recycle' | 'backup' | 'ignored'
    linkedRefs?: Array<{ table: string; column: string; row_id?: string | number | null; label?: string | null }>
    uploadedBy?: string | null
    metadata?: Record<string, string | number | boolean | null>
  },
): Promise<void> {
  const account = process.env.R2_ACCOUNT_ID ?? ''
  const bucket  = (process.env.R2_BUCKET ?? 'paintings').trim()
  const host    = r2S3Hostname(account)
  const url     = `https://${host}/${bucket}/${filename.split('/').map(encodeURIComponent).join('/')}`
  const headers = r2PutHeaders(buf, filename, contentType)
  const res     = await fetch(url, {
    method: 'PUT',
    headers,
    body: new Uint8Array(buf),
  })
  if (!res.ok) {
    const body = await res.text()
    let msg = `R2 PUT ${res.status}: ${body}`
    if (res.status === 404 && body.includes('NoSuchBucket')) {
      msg += `\n— Check: R2_BUCKET="${bucket}" exists on this Cloudflare account.`
      msg += `\n— EU buckets: set R2_JURISDICTION=eu or paste dashboard S3 API into R2_S3_API_URL= (hostname must include ".eu.").`
      msg += `\n— R2_ACCOUNT_ID must match the id in that API URL. Current API host used: ${host}`
    }
    throw new Error(msg)
  }
  await recordStorageObject({
    bucket,
    objectKey: filename,
    sizeBytes: buf.length,
    contentType,
    source: ledger?.source,
    classification: ledger?.classification,
    linkedRefs: ledger?.linkedRefs,
    uploadedBy: ledger?.uploadedBy,
    metadata: ledger?.metadata,
  })
}

/** Server-side R2 copy via S3 CopyObject (no bytes flow through this server). */
async function r2Copy(srcKey: string, dstKey: string): Promise<void> {
  const account   = process.env.R2_ACCOUNT_ID ?? ''
  const accessKey = process.env.R2_ACCESS_KEY_ID!
  const secretKey = process.env.R2_SECRET_ACCESS_KEY!
  const bucket    = (process.env.R2_BUCKET ?? 'paintings').trim()
  const host      = r2S3Hostname(account)
  const encodedPath = `/${bucket}/${dstKey.split('/').map(encodeURIComponent).join('/')}`
  const copySource  = `/${bucket}/${srcKey.split('/').map(encodeURIComponent).join('/')}`

  const now       = new Date()
  const amzDate   = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const dateStamp = amzDate.slice(0, 8)
  const bodyHash  = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

  const headers: Record<string, string> = {
    'host':                  host,
    'x-amz-copy-source':     copySource,
    'x-amz-date':            amzDate,
    'x-amz-content-sha256':  bodyHash,
  }
  const sortedKeys       = Object.keys(headers).sort()
  const canonicalHeaders = sortedKeys.map(k => `${k}:${headers[k]}\n`).join('')
  const signedHeaderStr  = sortedKeys.join(';')
  const canonicalRequest = ['PUT', encodedPath, '', canonicalHeaders, signedHeaderStr, bodyHash].join('\n')

  const region   = 'auto'
  const service  = 's3'
  const credScope = `${dateStamp}/${region}/${service}/aws4_request`
  const strToSign = ['AWS4-HMAC-SHA256', amzDate, credScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n')

  const hmac = (key: Buffer | string, data: string) => crypto.createHmac('sha256', key).update(data).digest()
  const sigKey = hmac(hmac(hmac(hmac('AWS4' + secretKey, dateStamp), region), service), 'aws4_request')
  const sig    = crypto.createHmac('sha256', sigKey).update(strToSign).digest('hex')

  headers['Authorization'] =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope}, SignedHeaders=${signedHeaderStr}, Signature=${sig}`

  const res = await fetch(`https://${host}${encodedPath}`, { method: 'PUT', headers })
  if (!res.ok) throw new Error(`R2 COPY ${res.status}: ${await res.text()}`)
}

/**
 * Phase D safety net: copy R2 object into `recycle/<YYYY-MM-DD>/<key>` before deleting.
 * Lifecycle rule on R2 bucket auto-purges `recycle/*` after 90 days. Reversible window
 * for accidental deletes — admin can copy back from recycle if needed.
 * Falls back to direct delete if the copy fails (e.g. object already missing) so the
 * primary delete path stays best-effort.
 */
async function r2SoftDelete(filename: string): Promise<void> {
  const day = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const dst = `recycle/${day}/${filename}`
  const bucket = (process.env.R2_BUCKET ?? 'paintings').trim()
  let copiedToRecycle = false
  try {
    await r2Copy(filename, dst)
    copiedToRecycle = true
    await recordStorageObject({
      bucket,
      objectKey: dst,
      source: 'r2_soft_delete',
      classification: 'recycle',
      status: 'present',
      linkedRefs: [{ table: 'storage_object_ledger', column: 'object_key', row_id: filename, label: 'source' }],
      metadata: { original_key: filename },
    })
  } catch (e) {
    console.warn('[r2SoftDelete] copy failed, falling through to delete:', (e as Error).message)
  }
  await r2Delete(filename)
  await markStorageObject({
    bucket,
    objectKey: filename,
    status: copiedToRecycle ? 'recycled' : 'deleted',
    metadata: copiedToRecycle ? { recycle_key: dst } : { recycle_failed: true },
  })
}

async function r2Delete(filename: string): Promise<void> {
  const account   = process.env.R2_ACCOUNT_ID ?? ''
  const accessKey = process.env.R2_ACCESS_KEY_ID!
  const secretKey = process.env.R2_SECRET_ACCESS_KEY!
  const bucket      = (process.env.R2_BUCKET ?? 'paintings').trim()
  const host        = r2S3Hostname(account)
  const encodedPath = `/${bucket}/${filename.split('/').map(encodeURIComponent).join('/')}`

  const now       = new Date()
  const amzDate   = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const dateStamp = amzDate.slice(0, 8)
  const bodyHash  = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // empty body

  const headers: Record<string, string> = {
    'host':                  host,
    'x-amz-date':           amzDate,
    'x-amz-content-sha256': bodyHash,
  }
  const sortedKeys       = Object.keys(headers).sort()
  const canonicalHeaders = sortedKeys.map(k => `${k}:${headers[k]}\n`).join('')
  const signedHeaderStr  = sortedKeys.join(';')
  const canonicalRequest = ['DELETE', encodedPath, '', canonicalHeaders, signedHeaderStr, bodyHash].join('\n')

  const region    = 'auto'
  const service   = 's3'
  const credScope = `${dateStamp}/${region}/${service}/aws4_request`
  const strToSign = ['AWS4-HMAC-SHA256', amzDate, credScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n')

  const hmac = (key: Buffer | string, data: string) =>
    crypto.createHmac('sha256', key).update(data).digest()
  const sigKey = hmac(hmac(hmac(hmac('AWS4' + secretKey, dateStamp), region), service), 'aws4_request')
  const sig    = crypto.createHmac('sha256', sigKey).update(strToSign).digest('hex')

  headers['Authorization'] =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope}, SignedHeaders=${signedHeaderStr}, Signature=${sig}`

  const url = `https://${host}${encodedPath}`
  const res = await fetch(url, { method: 'DELETE', headers })
  if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE ${res.status}: ${await res.text()}`)
}

type PreparedWorkImageUpload = {
  sourceBuf: Buffer
  sourceSha256: string
  avifBuf: Buffer
  thumbBuf: Buffer
}

function thumbNameFor(filename: string): string {
  return `thumbs/${filename.replace(/\.[^.]+$/, '')}.avif`
}

/**
 * Normalize upload to 4000px long-side AVIF (q=50), strip EXIF except Artist/Copyright,
 * and build the 400px AVIF thumb. Filename hash uses raw input bytes (stable across encoders).
 */
async function prepareWorkImageUpload(file: File): Promise<PreparedWorkImageUpload | { error: string }> {
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const check = await validateWorkImageBuffer(buf)
    if ('error' in check) return { error: check.error }

    const artist =
      process.env.IMAGE_EXIF_ARTIST?.trim() || 'PierreEmmanuelMoulin'
    const copyright =
      process.env.IMAGE_EXIF_COPYRIGHT?.trim() ||
      '© PierreEmmanuelMoulin · pppeeemmm@gmail.com'

    const avifBuf = await sharp(buf)
      .rotate()
      .resize({
        width: 4000,
        height: 4000,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .keepIccProfile()
      .withExif({
        IFD0: {
          Artist: artist,
          Copyright: copyright,
        },
      })
      .avif({ quality: 50, effort: 4, chromaSubsampling: '4:4:4' })
      .toBuffer()

    const thumbBuf = await sharp(avifBuf)
      .ensureAlpha()
      .resize({
        width: 400,
        height: 400,
        fit: 'inside',
        withoutEnlargement: true,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .avif({ quality: 70, effort: 3, chromaSubsampling: '4:4:4' })
      .toBuffer()

    return {
      sourceBuf: buf,
      sourceSha256: crypto.createHash('sha256').update(buf).digest('hex'),
      avifBuf,
      thumbBuf,
    }
  } catch (e) {
    return { error: String(e) }
  }
}

async function putPreparedWorkImage(
  prepared: PreparedWorkImageUpload,
  filename: string,
  oeuvreId: number,
  seq: number,
  uploadedBy?: string | null,
  source: 'work_image' | 'work_image_retouch' = 'work_image',
): Promise<void> {
  await r2Put(prepared.avifBuf, filename, 'image/avif', {
    source,
    classification: 'linked',
    linkedRefs: [{ table: 'Oeuvres', column: 'OeuvreID', row_id: oeuvreId }],
    uploadedBy,
    metadata: { seq },
  })

  const thumbName = thumbNameFor(filename)
  await r2Put(prepared.thumbBuf, thumbName, 'image/avif', {
    source: `${source}_thumb`,
    classification: 'linked',
    linkedRefs: [{ table: 'Oeuvres', column: 'OeuvreID', row_id: oeuvreId }],
    uploadedBy,
    metadata: { original_key: filename, seq },
  })
}

async function backupRetouchObject(
  filename: string,
  oeuvreId: number,
  imageId: number,
  uploadedBy?: string | null,
  kind: 'original' | 'thumb' = 'original',
): Promise<string | null> {
  const day = new Date().toISOString().slice(0, 10)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dst = `recycle/${day}/retouch/${stamp}/${filename}`
  const bucket = (process.env.R2_BUCKET ?? 'paintings').trim()
  try {
    await r2Copy(filename, dst)
    await recordStorageObject({
      bucket,
      objectKey: dst,
      source: 'work_image_retouch_backup',
      classification: 'recycle',
      status: 'present',
      linkedRefs: [{ table: 'tblImage', column: 'ImageID', row_id: imageId }],
      uploadedBy,
      metadata: { original_key: filename, oeuvre_id: oeuvreId, kind },
    })
    return dst
  } catch (e) {
    console.warn('[works/actions] backupRetouchObject', filename, e)
    return null
  }
}

/**
 * Normalize upload and add it as a new R2 work image + thumb.
 */
async function uploadImage(
  _supabase: SupabaseClient,
  file: File,
  oeuvreId: number,
  seq: number,
  uploadedBy?: string | null,
): Promise<{ ok: true; filename: string } | { error: string }> {
  const prepared = await prepareWorkImageUpload(file)
  if ('error' in prepared) return prepared
  const filename = makeImageStorageFilename(oeuvreId, seq, prepared.sourceBuf, 'avif')
  try {
    await putPreparedWorkImage(prepared, filename, oeuvreId, seq, uploadedBy)
    return { ok: true, filename }
  } catch (e) {
    return { error: String(e) }
  }
}

// ── Image management (tblImage) ───────────────────────────────────────────

// Helper: sync Oeuvres.txtImageNameLink to the last image (highest SeqNo = cover)
async function syncCover(supabase: SupabaseClient, oeuvreId: number): Promise<{ error: string } | { ok: true }> {
  const { data, error: selErr } = await supabase
    .from('tblImage')
    .select('txtImageNameLink')
    .eq('OeuvreID', oeuvreId)
    .order('SeqNo', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (selErr) return { error: `syncCover read: ${selErr.message}` }
  const { error: updErr } = await supabase
    .from('Oeuvres')
    .update({ txtImageNameLink: data?.txtImageNameLink ?? null })
    .eq('OeuvreID', oeuvreId)
  if (updErr) return { error: `syncCover write: ${updErr.message}` }
  return { ok: true }
}

// Add a new image to a work. FormData: { oeuvre_id, image (File) }
export async function addWorkImage(formData: FormData): Promise<ImageResult> {
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const oeuvreId = parseInt(formData.get('oeuvre_id') as string, 10)
  const file     = formData.get('image') as File | null
  if (isNaN(oeuvreId) || !file || file.size === 0) return { error: 'Paramètres invalides' }

  // Next SeqNo (per-work) + ImageID (global) in parallel — neither table has a sequence.
  const [seqRes, idRes] = await Promise.all([
    supabase
      .from('tblImage')
      .select('SeqNo')
      .eq('OeuvreID', oeuvreId)
      .order('SeqNo', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('tblImage')
      .select('ImageID')
      .order('ImageID', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (seqRes.error) return { error: `tblImage seq: ${seqRes.error.message}` }
  if (idRes.error)  return { error: `tblImage id: ${idRes.error.message}` }
  const seqNo   = ((seqRes.data?.SeqNo ?? 0) as number) + 1
  const imageId = ((idRes.data?.ImageID ?? 200) as number) + 1

  const uploadResult = await uploadImage(supabase, file, oeuvreId, seqNo, user.id)
  if ('error' in uploadResult) return { error: uploadResult.error }
  const filename = uploadResult.filename

  let captureMeta: Record<string, unknown> | null = null
  const captureMetaRaw = formData.get('image_capture_meta')
  if (typeof captureMetaRaw === 'string' && captureMetaRaw.trim()) {
    try {
      const parsed: unknown = JSON.parse(captureMetaRaw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        captureMeta = parsed as Record<string, unknown>
      }
    } catch {
      /* ignore invalid JSON */
    }
  }
  const imageSha256 =
    typeof formData.get('image_sha256') === 'string'
      ? (formData.get('image_sha256') as string).trim().slice(0, 64) || null
      : null

  const insertRow: Record<string, unknown> = {
    ImageID: imageId,
    OeuvreID: oeuvreId,
    txtImageNameLink: filename,
    SeqNo: seqNo,
    DateAdded: new Date().toISOString(),
  }
  if (captureMeta) insertRow.capture_meta = captureMeta
  if (imageSha256) insertRow.sha256 = imageSha256

  const { data: inserted, error: insertErr } = await supabase
    .from('tblImage')
    .insert(insertRow as never)
    .select()
    .single()

  if (insertErr || !inserted) return { error: insertErr?.message ?? 'Erreur insertion' }

  // New image is last → it becomes the cover.
  // If the work was in the photo gate (NeedsPhotograph=true + Catalogué=true),
  // uploading a photo clears the gate and moves it to statusId=2 (Disponible).
  const { data: workState } = await supabase
    .from('Oeuvres')
    .select('"Catalogué", "NeedsPhotograph"')
    .eq('OeuvreID', oeuvreId)
    .single()

  const wasInPhotoGate = workState?.NeedsPhotograph === true && workState?.['Catalogué'] === true
  const coverUpdate: Record<string, unknown> = {
    txtImageNameLink: inserted.txtImageNameLink,
    NeedsPhotograph: false,
  }
  if (wasInPhotoGate) {
    coverUpdate.statusId = 2  // Disponible
  }

  await supabase
    .from('Oeuvres')
    .update(coverUpdate)
    .eq('OeuvreID', oeuvreId)

  await logSystemEvent({
    eventType: 'VAULT_UPLOAD',
    tableName: 'Oeuvres',
    rowId: oeuvreId,
    newValue: inserted.txtImageNameLink,
    metadata: { source: 'image_manager', wasInPhotoGate },
  })

  if (workState) {
    const pipeRes = await syncPipelineWithBooleans(supabase, oeuvreId, {
      catalogued: !!workState['Catalogué'],
      needsPhotograph: false,
    })
    if ('error' in pipeRes) return { error: pipeRes.error }
  }

  revalidatePath('/atelier')
  return { ok: true, image: inserted as WorkImage }
}

// Replace an existing image slot after external retouching.
// Preserves ImageID, txtImageNameLink, and SeqNo so ordering, cover selection, and public URLs stay stable.
export async function replaceWorkImage(formData: FormData): Promise<ImageReplaceResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const oeuvreId = parseInt(formData.get('oeuvre_id') as string, 10)
  const imageId = parseInt(formData.get('image_id') as string, 10)
  const file = formData.get('image') as File | null
  if (isNaN(oeuvreId) || isNaN(imageId) || !file || file.size === 0) {
    return { error: 'Paramètres invalides' }
  }

  const { data: img, error: imgErr } = await supabase
    .from('tblImage')
    .select('ImageID, OeuvreID, txtImageNameLink, SeqNo, DateAdded')
    .eq('ImageID', imageId)
    .eq('OeuvreID', oeuvreId)
    .maybeSingle()
  if (imgErr) return { error: `tblImage: ${imgErr.message}` }
  if (!img?.txtImageNameLink || img.SeqNo == null) return { error: 'Image introuvable pour cette œuvre.' }

  const prepared = await prepareWorkImageUpload(file)
  if ('error' in prepared) return prepared

  const filename = img.txtImageNameLink
  const thumbName = thumbNameFor(filename)
  const [originalBackup, thumbBackup] = await Promise.all([
    backupRetouchObject(filename, oeuvreId, imageId, user.id, 'original'),
    backupRetouchObject(thumbName, oeuvreId, imageId, user.id, 'thumb'),
  ])

  try {
    await putPreparedWorkImage(prepared, filename, oeuvreId, img.SeqNo, user.id, 'work_image_retouch')
  } catch (e) {
    return { error: String(e) }
  }

  const updateRow: Record<string, unknown> = {
    DateAdded: new Date().toISOString(),
    sha256: prepared.sourceSha256,
  }

  const { data: updated, error: updateErr } = await supabase
    .from('tblImage')
    .update(updateRow as never)
    .eq('ImageID', imageId)
    .eq('OeuvreID', oeuvreId)
    .select('ImageID, OeuvreID, txtImageNameLink, SeqNo, DateAdded')
    .single()
  if (updateErr || !updated) return { error: updateErr?.message ?? 'Erreur mise à jour image' }

  await logSystemEvent({
    eventType: 'VAULT_UPLOAD',
    tableName: 'tblImage',
    rowId: imageId,
    newValue: filename,
    metadata: {
      source: 'image_retouch',
      oeuvreId,
      originalBackup,
      thumbBackup,
    },
  })

  revalidatePath('/atelier')
  return { ok: true, image: updated as WorkImage, cacheKey: prepared.sourceSha256.slice(0, 12) }
}

// Delete one image from a work. Admin only — image deletion is irreversible at R2 layer.
export async function deleteWorkImage(
  imageId: number,
  oeuvreId: number,
): Promise<DeleteResult> {
  const supabase = await createClient()
  const adminErr = await requireAdmin(supabase)
  if (adminErr) return { error: adminErr }

  // Get the path before deleting
  const { data: img } = await supabase
    .from('tblImage')
    .select('txtImageNameLink')
    .eq('ImageID', imageId)
    .single()

  const { error } = await supabase.from('tblImage').delete().eq('ImageID', imageId)
  if (error) return { error: error.message }

  // Remove original + thumbnail from R2
  if (img?.txtImageNameLink) {
    const filename = img.txtImageNameLink
    const thumbName = `thumbs/${filename.replace(/\.[^.]+$/, '')}.avif`
    // Fire-and-forget — don't block on R2 errors. Soft-delete moves to recycle/<date>/ first.
    try {
      await r2SoftDelete(filename)
    } catch (e) {
      console.warn('[works/actions] deleteWorkImage r2SoftDelete original', filename, e)
    }
    try {
      await r2SoftDelete(thumbName)
    } catch (e) {
      console.warn('[works/actions] deleteWorkImage r2SoftDelete thumb', thumbName, e)
    }
  }

  await syncCover(supabase, oeuvreId)
  revalidatePath('/atelier')
  return { ok: true }
}

// Reorder all images for a work by supplying the new ordered array of ImageIDs.
// SeqNo is reassigned 1, 2, 3… Last = cover.
export async function reorderWorkImages(
  oeuvreId: number,
  orderedIds: number[],
): Promise<DeleteResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: rows, error: selErr } = await supabase
    .from('tblImage')
    .select('ImageID')
    .eq('OeuvreID', oeuvreId)
  if (selErr) return { error: selErr.message }
  const allowed = new Set((rows ?? []).map((r: { ImageID: number }) => r.ImageID))
  if (orderedIds.length !== allowed.size) {
    return { error: 'Nombre d’images incorrect pour cette œuvre.' }
  }
  for (const id of orderedIds) {
    if (!allowed.has(id)) return { error: 'Image hors de cette œuvre.' }
  }

  const updates = orderedIds.map((id, i) =>
    supabase.from('tblImage').update({ SeqNo: i + 1 }).eq('ImageID', id).eq('OeuvreID', oeuvreId),
  )
  await Promise.all(updates)

  await syncCover(supabase, oeuvreId)
  revalidatePath('/atelier')
  return { ok: true }
}

export type WorkDrawerImageRow = Pick<
  Database['public']['Tables']['tblImage']['Row'],
  'ImageID' | 'txtImageNameLink' | 'SeqNo'
>

/** Drawer image rail — RLS `tblImage` read (same fields as legacy client fetch). */
export async function listWorkDrawerImages(oeuvreId: number): Promise<WorkDrawerImageRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('tblImage')
    .select('ImageID, txtImageNameLink, SeqNo')
    .eq('OeuvreID', oeuvreId)
    .order('SeqNo', { ascending: true })

  if (error) {
    await logError('listWorkDrawerImages failed', error, {
      source: 'listWorkDrawerImages',
      metadata: { oeuvreId },
    })
    return []
  }
  return (data ?? []) as WorkDrawerImageRow[]
}

/** Long text fields omitted from the bulk Atelier payload — fetch when comparing works or full edit. */
export async function loadOeuvreLongText(
  oeuvreId: number,
): Promise<{ Commentaires: string | null; Historique: string | null } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { data, error } = await supabase
    .from('Oeuvres')
    .select('Commentaires, Historique')
    .eq('OeuvreID', oeuvreId)
    .maybeSingle()
  if (error) return { error: error.message }
  return {
    Commentaires: data?.Commentaires ?? null,
    Historique: data?.Historique ?? null,
  }
}

const OEUVRES_KEYSET_SELECT =
  'OeuvreID, Titre, Technique, Support, "Année", Format, Hauteur, Largeur, Profondeur, Exposable, broadcast_ready, broadcast_caption_seed, Prix, PrixFinal, Discount, statusId, "Catalogué", txtImageNameLink, ContactID, LocalisationID, LocalisationDetail, is_public, Encadree, IsCommission, PresentationID, ReturnDate, DateLivraison, AcheteurID, NeedsPhotograph, anonymity_level, admin_override_anonymity'

export type OeuvresKeysetPageResult = {
  rows: Oeuvre[]
  nextCursor: number | null
  hasMore: boolean
}

/** Keyset page: `OeuvreID` descending; `beforeId` = smallest id already loaded. */
export async function fetchOeuvresKeysetPage(beforeId: number, limit: number): Promise<OeuvresKeysetPageResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { rows: [], nextCursor: null, hasMore: false }

  const lim = Math.min(Math.max(1, limit), 2000)
  const { data, error } = await supabase
    .from('Oeuvres')
    .select(OEUVRES_KEYSET_SELECT)
    .is('deleted_at', null)
    .order('OeuvreID', { ascending: false })
    .lt('OeuvreID', beforeId)
    .limit(lim + 1)

  if (error) {
    await logError('fetchOeuvresKeysetPage failed', error, {
      source: 'fetchOeuvresKeysetPage',
      metadata: { beforeId, limit: lim },
    })
    return { rows: [], nextCursor: null, hasMore: false }
  }
  const raw = (data ?? []) as unknown as Oeuvre[]
  const hasMore = raw.length > lim
  const rows = hasMore ? raw.slice(0, lim) : raw
  const nextCursor = hasMore && rows.length > 0 ? rows[rows.length - 1]!.OeuvreID : null
  return { rows, nextCursor, hasMore }
}

/** First keyset page (all ids < MAX_SAFE_INTEGER). Used when shell deferred catalogue chunk. */
export async function fetchOeuvresInitialKeysetPage(limit = 50): Promise<OeuvresKeysetPageResult> {
  return fetchOeuvresKeysetPage(Number.MAX_SAFE_INTEGER, limit)
}
