'use server'

import crypto, { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { validateWorkImageBuffer } from '@/lib/image-upload'
import { r2PutObject } from '@/lib/r2-s3-object'
import { logSystemEvent } from '@/lib/utils/logging'

const TASK_TYPES = new Set(['suggestion', 'improvement', 'maintenance', 'backlog', 'bug'])

export type CreateFieldIssueResult = { ok: true } | { ok: false; error: string }

function parseOptionalPositiveInt(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

function makeIssuePhotoKey(buf: Buffer, extWithoutDot: string): string {
  const hash8 = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8)
  const safeExt = extWithoutDot.replace(/[^a-z0-9]/gi, '').slice(0, 4) || 'jpg'
  return `field-issue/${randomUUID()}_${hash8}.${safeExt}`
}

async function addProductionActionFromIssue({
  supabase,
  oeuvreId,
  actionTypeId,
  note,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  oeuvreId: number
  actionTypeId: number
  note: string
}): Promise<boolean> {
  const { data: existing, error: existingError } = await supabase
    .from('work_action')
    .select('id,note')
    .eq('oeuvre_id', oeuvreId)
    .eq('action_type_id', actionTypeId)
    .eq('done', false)
    .limit(1)
    .maybeSingle()

  if (existingError) {
    console.error('[createFieldIssueReport:work_action:select]', existingError)
    return false
  }

  if (existing) {
    const mergedNote = [existing.note, note].filter(Boolean).join('\n\n---\n\n')
    const { error: updateError } = await supabase
      .from('work_action')
      .update({ note: mergedNote })
      .eq('id', existing.id)
    if (updateError) {
      console.error('[createFieldIssueReport:work_action:update]', updateError)
      return false
    }
    return true
  }

  const { error: insertError } = await supabase.from('work_action').insert({
    oeuvre_id: oeuvreId,
    action_type_id: actionTypeId,
    done: false,
    note,
  })
  if (insertError) {
    console.error('[createFieldIssueReport:work_action:insert]', insertError)
    return false
  }
  return true
}

export async function createFieldIssueReport(formData: FormData): Promise<CreateFieldIssueResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }

  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { ok: false, error: 'not_team' }

  const titleRaw = formData.get('action_title')
  const detailsRaw = formData.get('details')
  const typeRaw = formData.get('type')
  const title = typeof titleRaw === 'string' ? titleRaw.trim().slice(0, 300) : ''
  const details = typeof detailsRaw === 'string' ? detailsRaw.trim().slice(0, 12_000) : ''
  const type = typeof typeRaw === 'string' && TASK_TYPES.has(typeRaw) ? typeRaw : 'maintenance'
  const oeuvreId = parseOptionalPositiveInt(formData.get('oeuvre_id'))
  const actionTypeId = oeuvreId ? parseOptionalPositiveInt(formData.get('action_type_id')) : null

  if (!title) return { ok: false, error: 'missing_title' }

  if (oeuvreId) {
    const { data: work, error: workError } = await supabase
      .from('Oeuvres')
      .select('OeuvreID')
      .eq('OeuvreID', oeuvreId)
      .maybeSingle()
    if (workError || !work) return { ok: false, error: 'invalid_link' }
  }

  if (actionTypeId) {
    const { data: actionType, error: actionTypeError } = await supabase
      .from('work_action_type')
      .select('id')
      .eq('id', actionTypeId)
      .maybeSingle()
    if (actionTypeError || !actionType) return { ok: false, error: 'invalid_link' }
  }

  let photo_r2_key: string | null = null
  const file = formData.get('photo')
  if (file instanceof File && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer())
    if (buf.length > 8 * 1024 * 1024) return { ok: false, error: 'photo_too_large' }
    const validated = await validateWorkImageBuffer(buf)
    if ('error' in validated) return { ok: false, error: 'invalid_photo' }
    const key = makeIssuePhotoKey(buf, validated.ext)
    try {
      await r2PutObject(buf, key, validated.mime, {
        source: 'field_issue',
        classification: 'linked',
        linkedRefs: [{ table: 'studio_task', column: 'photo_r2_key' }],
        uploadedBy: user.id,
        metadata: { type },
      })
    } catch {
      return { ok: false, error: 'r2_failed' }
    }
    photo_r2_key = key
  }

  const severity =
    type === 'bug' ? 'high' : type === 'maintenance' ? 'medium' : 'low'
  const priority = type === 'bug' ? 'P2' : 'P3'
  const { data: task, error } = await supabase.from('studio_task').insert({
    action: title,
    details: details || null,
    type,
    priority,
    status: 'requested',
    kind: 'field',
    severity,
    photo_r2_key,
    oeuvre_id: oeuvreId,
    work_action_type_id: actionTypeId,
  }).select('id').single()

  if (error) {
    console.error('[createFieldIssueReport]', error)
    return { ok: false, error: 'insert_failed' }
  }

  let productionActionOk: boolean | undefined
  if (oeuvreId && actionTypeId) {
    const noteParts = [`Signalement #${task.id}: ${title}`]
    if (details) noteParts.push(details.slice(0, 500))
    productionActionOk = await addProductionActionFromIssue({
      supabase,
      oeuvreId,
      actionTypeId,
      note: noteParts.join('\n\n'),
    })
  }

  await logSystemEvent({
    eventType: 'SYSTEM_CONFIG',
    tableName: 'studio_task',
    rowId: String(task.id),
    metadata: {
      source: 'field_issue',
      type,
      severity,
      photo_r2_key,
      oeuvre_id: oeuvreId,
      work_action_type_id: actionTypeId,
      production_action_ok: productionActionOk,
    },
  })

  revalidatePath('/hub')
  revalidatePath('/atelier')
  return { ok: true }
}
