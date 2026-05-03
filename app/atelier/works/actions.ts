'use server'

// Server Actions for work creation and editing.
// Called from WorkForm (client component) via useTransition.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { makeFilename, seqFromFilename } from '@/lib/data'
import type { WorkImage } from '@/lib/types/database'
import crypto from 'crypto'
import sharp from 'sharp'

export type SaveResult   = { error: string } | { ok: true; newId?: number }
export type DeleteResult = { error: string } | { ok: true }
export type ImageResult  = { error: string } | { ok: true; image: WorkImage }

export async function deleteWork(oid: number): Promise<DeleteResult> {
  const supabase = await createClient()
  await supabase.from('tblrelations').delete().or(`source_id.eq.${oid},target_id.eq.${oid}`)
  await supabase.from('OeuvreTheme').delete().eq('OeuvreID', oid)
  const { error } = await supabase.from('Oeuvres').delete().eq('OeuvreID', oid)
  if (error) return { error: error.message }
  return { ok: true }
}

export async function deleteSelectedWorks(ids: number[]): Promise<DeleteResult> {
  const supabase = await createClient()
  // Delete all relations for all selected works
  for (const id of ids) {
    await supabase.from('tblrelations').delete().or(`source_id.eq.${id},target_id.eq.${id}`)
    await supabase.from('OeuvreTheme').delete().eq('OeuvreID', id)
  }
  const { error } = await supabase.from('Oeuvres').delete().in('OeuvreID', ids)
  if (error) return { error: error.message }
  revalidatePath('/atelier')
  return { ok: true }
}

// ── Save (create or update) ───────────────────────────────────────────────

export async function saveWork(formData: FormData): Promise<SaveResult> {
  const supabase = await createClient()

  // Auth bypassed for development
  const user = { id: 'dev' }
  const isTeam = true

  // ── Parse scalar fields ──────────────────────────────────────────────
  const oeuvreIdRaw  = (formData.get('oeuvre_id') as string | null)?.trim()
  const isNew        = !oeuvreIdRaw

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

  const exposable    = formData.get('exposable')     === '1'
  const montee       = formData.get('montee')      === '1'
  const encadree     = formData.get('encadree')      === '1'
  const catalogued   = formData.get('catalogued')    === '1'
  const isPublic     = formData.get('is_public')     === '1'
  const isCommission   = formData.get('is_commission') === '1'
  const dateLivraison  = (formData.get('date_livraison') as string | null)?.trim() || null
  const needsPhotograph = formData.get('needs_photograph') === '1'
  const anonymityLevel = numOrNull(formData.get('anonymity_level')) ?? 0
  const isPaid         = formData.get('is_paid') === '1'
  const isGift         = formData.get('is_gift') === '1'

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
      const filename = makeFilename(oid, 1, imageFile.name)
      const uploadResult = await uploadImage(supabase, imageFile, filename)
      if ('error' in uploadResult) return { error: uploadResult.error }
      imageName = filename
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
      is_public:         isPublic,
      IsCommission:      isCommission,
      DateLivraison:     dateLivraison,
      NeedsPhotograph:   needsPhotograph,
      anonymity_level:   anonymityLevel,
      is_paid:           isPaid,
      is_gift:           isGift,
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
      if (imgErr) console.error('tblImage insert:', imgErr.message)
    }

    // Insert themes
    if (themeIds.length > 0) {
      const { error: themeErr } = await supabase.from('OeuvreTheme').insert(
        themeIds.map((tid) => ({ OeuvreID: oid, ThemeID: tid })),
      )
      if (themeErr) return { error: themeErr.message }
    }

    revalidatePath('/atelier')
    return { ok: true, newId: oid }

  } else {
    const oid = parseInt(oeuvreIdRaw!, 10)
    if (isNaN(oid)) return { error: 'ID invalide' }

    // Fetch current record to compare statusId + ContactID for history
    const { data: current } = await supabase
      .from('Oeuvres')
      .select('statusId, ContactID, Historique')
      .eq('OeuvreID', oid)
      .single()

    // Use the user's edited text as the base (form field wins over DB).
    // Append the auto-generated location-change entry on top if contact changed.
    const historiqueAppend = formData.get('historique_append') as string | null
    let finalHistorique = historique ?? current?.Historique ?? ''
    if (historiqueAppend) {
      finalHistorique = finalHistorique ? `${finalHistorique}\n${historiqueAppend}` : historiqueAppend
    }

    // Upload new image if provided via form (separate from ImageManager flow)
    let formUploadedNewImage = false
    if (imageFile && imageFile.size > 0) {
      const seq      = seqFromFilename(imageExisting)
      const filename = makeFilename(oid, seq, imageFile.name)
      const uploadResult = await uploadImage(supabase, imageFile, filename)
      if ('error' in uploadResult) return { error: uploadResult.error }
      imageName = filename
      formUploadedNewImage = true
    }

    const isGift       = formData.get('is_gift')       === '1'
    const paymentDone  = formData.get('payment_received') === '1'
    const isAnonymous  = formData.get('is_anonymous') === '1'

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
      is_public:         isPublic,
      IsCommission:      isCommission,
      DateLivraison:     dateLivraison,
      NeedsPhotograph:   needsPhotograph,
      anonymity_level:   anonymityLevel,
      is_paid:           isPaid,
      is_gift:           isGift,
    }
    if (formUploadedNewImage) {
      updatePayload.txtImageNameLink = imageName
    }

    const { error: updateErr } = await supabase.from('Oeuvres').update(updatePayload).eq('OeuvreID', oid)

    if (updateErr) return { error: updateErr.message }

    // Replace themes: delete + reinsert
    await supabase.from('OeuvreTheme').delete().eq('OeuvreID', oid)
    if (themeIds.length > 0) {
      await supabase.from('OeuvreTheme').insert(themeIds.map(tid => ({ OeuvreID: oid, ThemeID: tid })))
    }

    // Replace working groups
    const groupIds = (formData.getAll('groups') as string[]).filter(Boolean)
    await saveWorkGroups(supabase, oid, groupIds)

    revalidatePath('/atelier')
    return { ok: true }
  }
}

async function saveWorkGroups(supabase: SupabaseClient, oid: number, gids: string[]) {
  await supabase.from('working_group_work').delete().eq('oeuvre_id', oid)
  if (gids.length > 0) {
    await supabase.from('working_group_work').insert(gids.map(gid => ({ oeuvre_id: oid, group_id: gid })))
  }
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
  const account   = process.env.R2_ACCOUNT_ID!
  const accessKey = process.env.R2_ACCESS_KEY_ID!
  const secretKey = process.env.R2_SECRET_ACCESS_KEY!
  const bucket    = process.env.R2_BUCKET ?? 'paintings'
  const host      = `${account}.r2.cloudflarestorage.com`
  const pathname  = `/${bucket}/${filename.split('/').map(encodeURIComponent).join('/')}`

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

async function r2Put(buf: Buffer, filename: string, contentType: string): Promise<void> {
  const account = process.env.R2_ACCOUNT_ID!
  const bucket  = process.env.R2_BUCKET ?? 'paintings'
  const url     = `https://${account}.r2.cloudflarestorage.com/${bucket}/${filename.split('/').map(encodeURIComponent).join('/')}`
  const headers = r2PutHeaders(buf, filename, contentType)
  const res     = await fetch(url, { method: 'PUT', headers, body: buf })
  if (!res.ok) throw new Error(`R2 PUT ${res.status}: ${await res.text()}`)
}

async function r2Delete(filename: string): Promise<void> {
  const account   = process.env.R2_ACCOUNT_ID!
  const accessKey = process.env.R2_ACCESS_KEY_ID!
  const secretKey = process.env.R2_SECRET_ACCESS_KEY!
  const bucket    = process.env.R2_BUCKET ?? 'paintings'
  const host      = `${account}.r2.cloudflarestorage.com`
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

/**
 * Upload original to R2 and generate + upload a 400px JPEG thumbnail
 * to thumbs/<filename>.jpg — automatically for every new image.
 */
async function uploadImage(
  _supabase: SupabaseClient,
  file: File,
  filename: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const buf = Buffer.from(await file.arrayBuffer())

    // Upload original
    await r2Put(buf, filename, file.type || 'application/octet-stream')

    // Generate 400px thumbnail (AVIF, quality 70) and upload to thumbs/
    const thumbBuf  = await sharp(buf)
      .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
      .avif({ quality: 70, effort: 3 })
      .toBuffer()
    const thumbName = `thumbs/${filename.replace(/\.[^.]+$/, '')}.avif`
    await r2Put(thumbBuf, thumbName, 'image/avif')

    return { ok: true }
  } catch (e) {
    return { error: String(e) }
  }
}

// ── Image management (tblImage) ───────────────────────────────────────────

// Helper: sync Oeuvres.txtImageNameLink to the last image (highest SeqNo = cover)
async function syncCover(supabase: SupabaseClient, oeuvreId: number) {
  const { data } = await supabase
    .from('tblImage')
    .select('txtImageNameLink')
    .eq('OeuvreID', oeuvreId)
    .order('SeqNo', { ascending: false })
    .limit(1)
    .single()
  await supabase
    .from('Oeuvres')
    .update({ txtImageNameLink: data?.txtImageNameLink ?? null })
    .eq('OeuvreID', oeuvreId)
}

// Add a new image to a work. FormData: { oeuvre_id, image (File) }
export async function addWorkImage(formData: FormData): Promise<ImageResult> {
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const oeuvreId = parseInt(formData.get('oeuvre_id') as string, 10)
  const file     = formData.get('image') as File | null
  if (isNaN(oeuvreId) || !file || file.size === 0) return { error: 'Paramètres invalides' }

  // Next SeqNo = current max + 1
  const { data: maxRow } = await supabase
    .from('tblImage')
    .select('SeqNo')
    .eq('OeuvreID', oeuvreId)
    .order('SeqNo', { ascending: false })
    .limit(1)
    .single()
  const seqNo = ((maxRow?.SeqNo ?? 0) as number) + 1

  // Next ImageID (no sequence in this table)
  const { data: maxId } = await supabase
    .from('tblImage')
    .select('ImageID')
    .order('ImageID', { ascending: false })
    .limit(1)
    .single()
  const imageId = ((maxId?.ImageID ?? 200) as number) + 1

  const filename = makeFilename(oeuvreId, seqNo, file.name)
  const uploadResult = await uploadImage(supabase, file, filename)
  if ('error' in uploadResult) return { error: uploadResult.error }

  const { data: inserted, error: insertErr } = await supabase
    .from('tblImage')
    .insert({
      ImageID:          imageId,
      OeuvreID:         oeuvreId,
      txtImageNameLink: filename,
      txtImageName:     file.name,
      SeqNo:            seqNo,
      DateAdded:        new Date().toISOString(),
    })
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
    coverUpdate.is_public = true
  }

  await supabase
    .from('Oeuvres')
    .update(coverUpdate)
    .eq('OeuvreID', oeuvreId)

  revalidatePath('/atelier')
  return { ok: true, image: inserted as WorkImage }
}

// Delete one image from a work
export async function deleteWorkImage(
  imageId: number,
  oeuvreId: number,
): Promise<DeleteResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

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
    // Fire-and-forget — don't block on R2 delete errors
    try { await r2Delete(filename) } catch {}
    try { await r2Delete(thumbName) } catch {}
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

  // Update SeqNo for each image in the new order
  const updates = orderedIds.map((id, i) =>
    supabase.from('tblImage').update({ SeqNo: i + 1 }).eq('ImageID', id),
  )
  await Promise.all(updates)

  await syncCover(supabase, oeuvreId)
  revalidatePath('/atelier')
  return { ok: true }
}
