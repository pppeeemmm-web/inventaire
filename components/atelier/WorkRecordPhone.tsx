'use client'

// R3 step 3 — phone recording drawer (docs/design/2026-11-16/WorkCard.notes.md « Phone recording drawer »,
// mockup WorkCard.phone.html screens 1 / 1b). Shown by WorkForm for a NEW work on the phone; « Tous les
// champs » goes back to the full form. Two modes:
//  · Nouvelle œuvre — new number: photo, title, technique, support, dimensions, place, voice note;
//    behind ▸: source, period, « peinte sur l'ancien support de… » (`painted_on` link).
//  · Reprise d'une œuvre — same number: photo at the end of its strip + a « Reprise » line in
//    Historique de création (`work_creation_step`, kind `resumed`), place, note. The stage does not move.
// Pictures: one button, no `capture` (CLAUDE.md: Lightroom → Share → PEM is the canonical path).

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { PEM_CONTACT_ID, thumbUrl } from '@/lib/data'
import type { SaveResult } from '@/app/atelier/works/actions'
import { addWorkImage, createLookup, listWorkDrawerImages, reorderWorkImages } from '@/app/atelier/works/actions'
import { searchWorksForRecord, type RecordWorkHit } from '@/app/atelier/works/record-actions'
import { saveCreationStep, savePlace, saveSource, setWorkPeriod, setWorkSources } from '@/app/atelier/works/period-source-actions'
import { addWorkLink } from '@/app/atelier/works/work-link-actions'
import { setProductionOrigin } from '@/app/atelier/works/production-actions'
import { attachShareInboxToWork, type ShareInboxWorkPrefill } from '@/app/atelier/share-triage/actions'
import { downscaleImageFileForMobileIfNeeded } from '@/lib/mobile/image-upload-client'
import { workSaveErrorToastMessage } from '@/lib/work-save-error'
import { patchPeriodSource, usePeriodSource } from '@/lib/atelier/use-period-source'
import { autoPeriodFor, nearestPlace, parseStepDate, placeFitsDate, placeLabel, sortPlaces } from '@/lib/work-periods'
import { VoiceNoteSheet } from '@/components/shared/VoiceNoteSheet'

type Row = { id: number; label: string }

// « Brouillon » (Pem 2026-11-18): a new work's typed fields kept on this phone (localStorage, survives
// closing the app), picked up the next time the screen opens in « Nouvelle œuvre ». Photos are not kept.
const DRAFT_KEY = 'pem-record-draft-v1'
const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
type RecordDraft = {
  titre: string; techniqueId: string; supportId: string; formatId: string; h: string; w: string; d: string
  placeId: string; note: string; sourceId: string; periodId: string; paintedOn: RecordWorkHit | null; savedAt: number
  origin?: '' | 'new' | 'found'
  foundYear?: string; foundFinished?: boolean | null
}
const clearRecordDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY)
  // eslint-disable-next-line pem-i18n/no-silent-catch -- browser storage blocked or full: the draft is optional
  } catch { /* storage blocked: nothing kept */ }
}
type Mode = 'new' | 'reprise'

const H = 48
const field = {
  width: '100%',
  minWidth: 0,
  height: H,
  boxSizing: 'border-box' as const,
  border: '1px solid var(--bd2)',
  borderRadius: 3,
  background: 'var(--bg0)',
  color: 'var(--tx)',
  padding: '0 12px',
  fontFamily: 'inherit',
  fontSize: 16, // ≥16 px: iOS does not zoom on focus
}
const lbl = { display: 'block', margin: '12px 0 4px', fontSize: 12, color: 'var(--tx3)' } as const

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** What the recording drawer hands to the full form (new work only). */
export type WorkRecordHandoff = {
  titre: string; techniqueId: string; supportId: string; formatId: string
  h: string; w: string; d: string
  origin: '' | 'new' | 'found'
  /** « Ancienne — retrouvée » answers (FoundWorkFlow.md): year typed (may be empty), « Terminée ? ». */
  foundYear: string
  foundFinished: boolean | null
  files: File[]
  techniques: { TechniqueID: number; Technique: string | null }[]
  supports: { SupportID: number; Support: string | null }[]
  formats: { FormatID: number; Format: string | null }[]
}

/** What « ← Formulaire court » brings back from the full form (Pem 2026-11-27: « can't go back to simple form »). */
export type WorkRecordCarryBack = Pick<WorkRecordHandoff, 'titre' | 'techniqueId' | 'supportId' | 'formatId' | 'h' | 'w' | 'd' | 'origin' | 'foundYear' | 'foundFinished' | 'files'>

export type WorkRecordPhoneProps = {
  techniques: { TechniqueID: number; Technique: string | null }[]
  supports: { SupportID: number; Support: string | null }[]
  formats: { FormatID: number; Format: string | null }[]
  action: (fd: FormData) => Promise<SaveResult>
  shareInboxPrefill?: ShareInboxWorkPrefill | null
  pemContactId?: number | null
  /** « Tous les champs » → the full WorkForm, carrying what was typed / photographed. */
  onAllFields: (draft: WorkRecordHandoff) => void
  /** First mode shown (`/atelier/works/new?record=reprise` → « Reprise »). */
  initialMode?: Mode
  /** Back from « Tous les champs »: the fields start from what was typed there (no kept « Brouillon » then). */
  carryBack?: WorkRecordCarryBack | null
}

/** Select ending with « + Nouveau … » (inline add kept on the phone, Pem v3). */
function LookupSelect({ value, rows, onChange, onAdd, label, newLabel, testId }: {
  value: string
  rows: Row[]
  onChange: (v: string) => void
  onAdd: (name: string) => Promise<void>
  label: string
  newLabel: string
  testId: string
}) {
  const { t } = useI18n()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  if (adding) {
    return (
      <div style={{ display: 'flex', gap: 4, minWidth: 0 }}>
        <input autoFocus aria-label={newLabel} placeholder={newLabel} value={name} onChange={(e) => setName(e.target.value)} style={{ ...field, flex: 1 }} />
        <button type="button" className="btn primary sm" style={{ minWidth: 44, height: H }} disabled={!name.trim()}
          onClick={() => void onAdd(name.trim()).then(() => { setAdding(false); setName('') })}>
          {t('wr_ok')}
        </button>
        <button type="button" className="btn ghost sm" aria-label={t('wr_cancel')} style={{ minWidth: 44, height: H }} onClick={() => setAdding(false)}>×</button>
      </div>
    )
  }
  return (
    <select aria-label={label} data-testid={testId} value={value} style={field}
      onChange={(e) => (e.target.value === '__new' ? setAdding(true) : onChange(e.target.value))}>
      <option value="">{t('select_option_placeholder')}</option>
      {rows.map((r) => <option key={r.id} value={String(r.id)}>{r.label}</option>)}
      <option value="__new">{newLabel}</option>
    </select>
  )
}

/** Pick a work by #id or title (Reprise; « peinte sur l'ancien support de… »). */
function WorkPicker({ value, onPick, label, testId }: { value: RecordWorkHit | null; onPick: (w: RecordWorkHit | null) => void; label: string; testId: string }) {
  const { t } = useI18n()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<RecordWorkHit[]>([])
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)
  useEffect(() => {
    const term = q.trim()
    if (!term) return void setHits([])
    const n = ++seq.current
    const id = setTimeout(() => {
      setBusy(true)
      void searchWorksForRecord(term).then((res) => {
        if (n !== seq.current) return
        setBusy(false)
        setHits('hits' in res ? res.hits : [])
      })
    }, 250)
    return () => clearTimeout(id)
  }, [q])
  if (value) {
    const src = thumbUrl(value.cover)
    return (
      <div data-testid={testId} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: 6, border: '1px solid var(--bd2)', borderRadius: 3, minWidth: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- R2 thumb, as WorkRef */}
        {src ? <img src={src} alt="" width={44} height={44} style={{ objectFit: 'cover', flexShrink: 0, borderRadius: 2 }} /> : <span style={{ width: 44, height: 44, flexShrink: 0, background: 'var(--bg3)' }} />}
        <div style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', fontSize: 14 }}>
          <b>#{value.id}</b> {value.title || t('wr_untitled')}
          {value.year ? <span style={{ color: 'var(--tx3)', fontSize: 12 }}> · {value.year}</span> : null}
        </div>
        <button type="button" className="btn ghost sm" style={{ minHeight: 44, flexShrink: 0 }} onClick={() => { onPick(null); setQ('') }}>{t('wr_change')}</button>
      </div>
    )
  }
  return (
    <div style={{ minWidth: 0 }}>
      <input type="search" inputMode="search" aria-label={label} placeholder={t('wr_pick_ph')} data-testid={testId}
        value={q} onChange={(e) => setQ(e.target.value)} style={field} />
      {busy ? <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 4 }}>{t('wr_searching')}</div> : null}
      {hits.length > 0 ? (
        <div role="listbox" style={{ border: '1px solid var(--bd2)', borderTop: 'none', maxHeight: 264, overflowY: 'auto' }}>
          {hits.map((h) => (
            <button key={h.id} type="button" role="option" aria-selected={false} onClick={() => onPick(h)}
              style={{ display: 'block', width: '100%', minHeight: 44, textAlign: 'left', padding: '8px 12px', background: 'var(--bg1)', border: 'none', borderBottom: '1px solid var(--bd)', color: 'var(--tx)', fontFamily: 'inherit', fontSize: 14, overflowWrap: 'anywhere' }}>
              <b>#{h.id}</b> {h.title || t('wr_untitled')}{h.year ? <span style={{ color: 'var(--tx3)' }}> · {h.year}</span> : null}
            </button>
          ))}
        </div>
      ) : q.trim() && !busy ? (
        <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 4 }}>{t('wr_no_hit')}</div>
      ) : null}
    </div>
  )
}

export function WorkRecordPhone({ techniques, supports, formats, action, shareInboxPrefill = null, pemContactId, onAllFields, initialMode = 'new', carryBack = null }: WorkRecordPhoneProps) {
  const { t, lang } = useI18n()
  const router = useRouter()
  const ps = usePeriodSource()
  const [pending, startTransition] = useTransition()

  const [mode, setMode] = useState<Mode>(carryBack ? 'new' : initialMode)
  const [files, setFiles] = useState<File[]>(carryBack?.files ?? [])
  const fileRef = useRef<HTMLInputElement | null>(null)
  const sharedCount = shareInboxPrefill?.imageFiles?.length ?? 0

  const [tech, setTech] = useState(techniques.map((r) => ({ id: r.TechniqueID, label: r.Technique ?? '' })))
  const [supp, setSupp] = useState(supports.map((r) => ({ id: r.SupportID, label: r.Support ?? '' })))
  const [fmts, setFmts] = useState(formats.map((r) => ({ id: r.FormatID, label: r.Format ?? '' })))
  const [titre, setTitre] = useState(carryBack?.titre ?? shareInboxPrefill?.titre ?? '')
  // « Nouvelle / Ancienne — retrouvée » (same choice as the desk form); none = the server's rule.
  const [origin, setOrigin] = useState<'' | 'new' | 'found'>(carryBack?.origin ?? '')
  const [foundYear, setFoundYear] = useState(carryBack?.foundYear ?? '')
  const [foundFinished, setFoundFinished] = useState<boolean | null>(carryBack?.foundFinished ?? null)
  const [techniqueId, setTechniqueId] = useState(carryBack?.techniqueId ?? '')
  const [supportId, setSupportId] = useState(carryBack?.supportId ?? '')
  const [formatId, setFormatId] = useState(carryBack?.formatId ?? '')
  const [h, setH] = useState(carryBack?.h ?? '')
  const [w, setW] = useState(carryBack?.w ?? '')
  const [d, setD] = useState(carryBack?.d ?? '')

  const [placeId, setPlaceId] = useState('')
  const [placeAuto, setPlaceAuto] = useState(false)
  const [newPlace, setNewPlace] = useState<string | null>(null)
  const [voiceAfter, setVoiceAfter] = useState(false)
  const [voiceFor, setVoiceFor] = useState<number | null>(null)

  const [more, setMore] = useState(false)
  const [sourceId, setSourceId] = useState('')
  const [periodId, setPeriodId] = useState('')
  const [paintedOn, setPaintedOn] = useState<RecordWorkHit | null>(null)

  const [work, setWork] = useState<RecordWorkHit | null>(null)
  const [stepDate, setStepDate] = useState(todayIso())
  const [note, setNote] = useState('')

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  // Places offered for the line's date (R3 « place vs date »: no-op until places carry dates).
  const lineDate = useMemo(() => {
    const p = mode === 'reprise' ? parseStepDate(stepDate) : { on_date: todayIso(), date_precision: 'day' as const }
    return p === 'bad' ? { on_date: null, date_precision: null } : p
  }, [mode, stepDate])
  const places = useMemo(
    () => sortPlaces(ps.places).filter((p) => String(p.id) === placeId || placeFitsDate(p, lineDate.on_date, lineDate.date_precision)),
    [ps.places, placeId, lineDate],
  )

  // Place « auto »: the current period's atelier at once; the nearest saved place when location is
  // already allowed (no permission prompt on open — « 📍 » asks).
  const touchedPlace = useRef(false)
  const locate = (ask: boolean) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = nearestPlace(pos.coords.latitude, pos.coords.longitude, ps.places)
        if (p && (ask || !touchedPlace.current)) {
          setPlaceId(String(p.id))
          setPlaceAuto(true)
        } else if (ask) toast.info(t('wr_place_none_near'))
      },
      () => { if (ask) toast.error(t('wr_place_locate_failed')) },
      { timeout: 8000, maximumAge: 600_000 },
    )
  }
  useEffect(() => {
    if (touchedPlace.current || placeId || ps.places.length === 0) return
    const per = autoPeriodFor({ day: todayIso(), year: new Date().getFullYear() }, ps.periods)
    if (per?.default_place_id) {
      setPlaceId(String(per.default_place_id))
      setPlaceAuto(true)
    }
    const perm = (navigator as Navigator & { permissions?: Permissions }).permissions
    void perm?.query({ name: 'geolocation' as PermissionName }).then((s) => { if (s.state === 'granted') locate(false) }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when places arrive
  }, [ps.places.length])

  // Pick up a kept « Brouillon » once, for a new work that does not come from the share sheet.
  useEffect(() => {
    if (initialMode !== 'new' || shareInboxPrefill || carryBack) return
    let dr: RecordDraft | null = null
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      dr = raw ? (JSON.parse(raw) as RecordDraft) : null
    // eslint-disable-next-line pem-i18n/no-silent-catch -- browser storage blocked or full: the draft is optional
    } catch {
      clearRecordDraft()
    }
    if (!dr) return
    if (Date.now() - (dr.savedAt ?? 0) > DRAFT_MAX_AGE_MS) return clearRecordDraft()
    setTitre(dr.titre ?? ''); setTechniqueId(dr.techniqueId ?? ''); setSupportId(dr.supportId ?? ''); setFormatId(dr.formatId ?? '')
    setH(dr.h ?? ''); setW(dr.w ?? ''); setD(dr.d ?? ''); setNote(dr.note ?? '')
    setSourceId(dr.sourceId ?? ''); setPeriodId(dr.periodId ?? ''); setPaintedOn(dr.paintedOn ?? null); setOrigin(dr.origin ?? '')
    setFoundYear(dr.foundYear ?? ''); setFoundFinished(dr.foundFinished ?? null)
    if (dr.placeId) {
      touchedPlace.current = true
      setPlaceId(dr.placeId)
      setPlaceAuto(false)
    }
    if (dr.sourceId || dr.periodId || dr.paintedOn) setMore(true)
    const when = new Date(dr.savedAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short' })
    toast.info(t('wr_draft_restored').replace('{date}', when), {
      ttlMs: 8000,
      action: {
        label: t('wr_draft_clear'),
        onClick: () => {
          clearRecordDraft()
          setTitre(''); setTechniqueId(''); setSupportId(''); setFormatId(''); setH(''); setW(''); setD(''); setNote('')
          setSourceId(''); setPeriodId(''); setPaintedOn(null); setOrigin(''); setFoundYear(''); setFoundFinished(null)
        },
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, [])

  const keepDraft = () => {
    const dr: RecordDraft = { titre, techniqueId, supportId, formatId, h, w, d, placeId, note, sourceId, periodId, paintedOn, origin, foundYear, foundFinished, savedAt: Date.now() }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(dr))
    // eslint-disable-next-line pem-i18n/no-silent-catch -- browser storage blocked or full: the draft is optional
    } catch {
      return void toast.error(t('wr_draft_kept'))
    }
    toast.success(t('wr_draft_kept'))
    router.back()
  }

  const dirty =
    files.length > 0 || !!titre.trim() || !!techniqueId || !!supportId || !!formatId || !!h || !!w || !!d || !!note.trim() || !!work || !!paintedOn || !!sourceId || !!periodId || !!origin || !!foundYear || foundFinished != null

  async function addLookup(table: 'Technique' | 'Support' | 'Format', name: string) {
    const label = name.charAt(0).toUpperCase() + name.slice(1)
    const res = await createLookup(table, label)
    if ('error' in res) return void toast.error(`${t('error_prefix')} ${res.error}`)
    const row = { id: res.id, label }
    if (table === 'Technique') { setTech((p) => [...p, row]); setTechniqueId(String(res.id)) }
    else if (table === 'Support') { setSupp((p) => [...p, row]); setSupportId(String(res.id)) }
    else { setFmts((p) => [...p, row]); setFormatId(String(res.id)) }
  }

  async function addPlace() {
    const name = (newPlace ?? '').trim()
    if (!name) return
    const res = await savePlace({ name })
    if ('error' in res) return void toast.error(res.error === 'duplicate' ? t('ps_err_place_duplicate') : `${t('error_prefix')} ${res.error}`)
    patchPeriodSource((dd) => ({ ...dd, places: [...dd.places.filter((x) => x.id !== res.place.id), res.place] }))
    touchedPlace.current = true
    setPlaceId(String(res.place.id))
    setPlaceAuto(false)
    setNewPlace(null)
  }

  async function addSource(name: string) {
    const res = await saveSource({ name })
    if ('error' in res) return void toast.error(`${t('error_prefix')} ${res.error}`)
    patchPeriodSource((dd) => ({ ...dd, sources: [...dd.sources.filter((x) => x.id !== res.source.id), res.source] }))
    setSourceId(String(res.source.id))
  }

  /** Upload the picked pictures (+ the shared ones). `atEnd`: keep the old cover — the new pictures go to the end of the strip. */
  async function addPictures(oid: number, atEnd: boolean): Promise<'ok' | 'pending' | 'error'> {
    const before = atEnd ? (await listWorkDrawerImages(oid)).map((r) => r.ImageID) : []
    let pendingImg = false
    if (shareInboxPrefill?.inboxId) {
      const att = await attachShareInboxToWork(shareInboxPrefill.inboxId, oid)
      if ('error' in att) { toast.error(`${t('error_prefix')} ${att.error}`); return 'error' }
      if (att.pending) pendingImg = true
    }
    for (const file of files) {
      const prepared = await downscaleImageFileForMobileIfNeeded(file, true)
      const fd = new FormData()
      fd.append('image', prepared)
      fd.append('oeuvre_id', String(oid))
      const up = await addWorkImage(fd)
      if ('error' in up) { toast.error(`${t('error_prefix')} ${up.error}`); return 'error' }
      if ('pending' in up) pendingImg = true
    }
    if (atEnd && before.length > 0 && !pendingImg) {
      const after = (await listWorkDrawerImages(oid)).map((r) => r.ImageID)
      const added = after.filter((id) => !before.includes(id))
      // Strip = cover first (highest SeqNo): the lowest SeqNo is its end.
      if (added.length > 0) {
        const r = await reorderWorkImages(oid, [...added, ...before.filter((id) => after.includes(id))])
        if ('error' in r) toast.error(`${t('error_prefix')} ${r.error}`)
      }
    }
    return pendingImg ? 'pending' : 'ok'
  }

  function finish(oid: number | null, withVoice: boolean) {
    if (mode === 'new') clearRecordDraft()
    if (withVoice && oid) return void setVoiceFor(oid)
    router.push('/hub')
    router.refresh()
  }

  function submitNew() {
    // « Ancienne — retrouvée » (FoundWorkFlow.md): « Terminée ? » is required; the year, when typed, is 4 digits.
    const year = origin === 'found' ? foundYear.trim() : ''
    if (origin === 'found' && foundFinished == null) return void toast.error(t('wf_found_need_answer'))
    if (year && (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > new Date().getFullYear())) return void toast.error(t('wf_found_year_bad'))
    const pem = String(pemContactId ?? PEM_CONTACT_ID)
    const fd = new FormData()
    const set = (k: string, v: string) => fd.set(k, v)
    set('oeuvre_id', '')
    set('titre', titre.trim())
    set('annee', year)
    set('technique', techniqueId)
    set('support', supportId)
    set('format', formatId)
    set('hauteur', h.trim())
    set('largeur', w.trim())
    set('profondeur', d.trim())
    // Same defaults as WorkForm.handleSubmit for a new work: atelier stage, Pem owns and holds it.
    set('catalogued', '0')
    set('needs_photograph', '0')
    set('anonymity_level', '0')
    set('prix', '0')
    set('discount', '0')
    set('exposable', '0')
    set('prix_final', '0')
    set('is_paid', '0')
    set('commentaires', '')
    set('historique', '')
    set('contact_id', pem)
    set('localisation_id', pem)
    set('acheteur_id', '')
    set('place_id', '')
    set('status_id', '1')
    set('tva_rate', '0')
    set('broadcast_ready', '0')
    set('broadcast_caption_seed', '')
    set('production_origin', origin)
    startTransition(async () => {
      const res = await action(fd)
      if ('error' in res) return void toast.error(workSaveErrorToastMessage(res.error, t))
      if (res.pending || typeof res.newId !== 'number') {
        // Team member: the new work waits for Pem's approval in Audit; pictures and extras need its number.
        toast.success(files.length || sharedCount || placeId || sourceId || periodId || paintedOn ? t('wf_save_pending_images_skipped_toast') : t('wf_save_pending_toast'))
        // The « Terminée ? Oui » answer goes through an admin door: Pem sets it on the card when approving.
        if (origin === 'found' && foundFinished) toast.info(t('wf_found_answer_later'))
        return finish(null, false)
      }
      const oid = res.newId
      const pics = files.length || sharedCount ? await addPictures(oid, false) : 'ok'
      // « Terminée ? Oui » once the photos are in: end that year, catalogued when it has a photo (the year itself
      // went in with the work, its Historique line too).
      if (origin === 'found' && foundFinished) {
        const done = await setProductionOrigin(oid, 'found', { finished: true, year: year ? Number(year) : null })
        if ('error' in done) toast.error(`${t('error_prefix')} ${done.error}`)
        else if (done.needsPhoto) toast.info(t('wf_found_needs_photo'))
      }
      const extras: Promise<{ ok: true } | { error: string }>[] = []
      if (placeId) extras.push(saveCreationStep({ oeuvre_id: oid, on_date: null, date_precision: null, kind: 'worked', place_id: Number(placeId), note: null }))
      if (sourceId) extras.push(setWorkSources(oid, [Number(sourceId)]))
      if (periodId) extras.push(setWorkPeriod(oid, Number(periodId)))
      if (paintedOn) extras.push(addWorkLink(oid, paintedOn.id, 'painted_on'))
      const out = await Promise.all(extras)
      const bad = out.find((r) => 'error' in r) as { error: string } | undefined
      if (bad) toast.error(`${t('error_prefix')} ${bad.error}`)
      else toast.success(t('wr_created').replace('{id}', String(oid)) + (pics === 'pending' ? ` ${t('wr_pics_pending')}` : ''))
      finish(oid, voiceAfter)
    })
  }

  function submitReprise() {
    if (!work) return void toast.error(t('wr_pick_first'))
    const date = parseStepDate(stepDate)
    if (date === 'bad') return void toast.error(t('cr_err_date'))
    startTransition(async () => {
      const line = await saveCreationStep({
        oeuvre_id: work.id,
        ...date,
        kind: 'resumed',
        place_id: placeId ? Number(placeId) : null,
        note: note.trim() || null,
      })
      if ('error' in line) {
        // `empty` can't happen: a Reprise line always carries its date unless cleared.
        return void toast.error(line.error === 'place_date' ? t('wr_place_date_err') : `${t('error_prefix')} ${line.error}`)
      }
      patchPeriodSource((dd) => ({ ...dd, creation: { ...dd.creation, [work.id]: [...(dd.creation[work.id] ?? []), line.step] } }))
      const pics = files.length || sharedCount ? await addPictures(work.id, true) : 'ok'
      if (pics === 'error') return
      toast.success(t('wr_reprise_done').replace('{id}', String(work.id)) + (pics === 'pending' ? ` ${t('wr_pics_pending')}` : ''))
      finish(work.id, false)
    })
  }

  const close = () => {
    if (dirty && !window.confirm(t('wr_leave_confirm'))) return
    if (mode === 'new') clearRecordDraft()
    router.back()
  }

  const modeBtn = (m: Mode, label: string) => (
    <button type="button" aria-pressed={mode === m} data-testid={`work-record-mode-${m}`} onClick={() => setMode(m)}
      style={{ flex: 1, minWidth: 0, minHeight: 44, border: 'none', borderRadius: 3, fontFamily: 'inherit', fontSize: 14, fontWeight: mode === m ? 700 : 500,
        background: mode === m ? 'var(--bg3)' : 'transparent', color: mode === m ? 'var(--tx)' : 'var(--tx3)' }}>
      {label}
    </button>
  )

  const pictureBox = (
    <div style={{ marginTop: 12, border: '1px dashed var(--bd3)', borderRadius: 4, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden data-testid="work-record-file"
        onChange={(e) => { const l = Array.from(e.target.files ?? []); if (l.length) setFiles((p) => [...p, ...l]); e.target.value = '' }} />
      {previews.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
          {previews.map((u, i) => (
            <div key={u} style={{ position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob:) */}
              <img src={u} alt="" width={72} height={72} style={{ objectFit: 'cover', borderRadius: 2, display: 'block' }} />
              <button type="button" aria-label={t('wr_pic_remove')} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                style={{ position: 'absolute', top: -6, right: -6, width: 28, height: 28, borderRadius: 14, border: '1px solid var(--bd3)', background: 'var(--bg2)', color: 'var(--tx)', padding: 0 }}>×</button>
            </div>
          ))}
        </div>
      ) : null}
      {sharedCount > 0 ? <small style={{ color: 'var(--sage)' }}>{t('wr_pics_shared').replace('{n}', String(sharedCount))}</small> : null}
      <button type="button" className="btn" data-testid="work-record-add-photo" onClick={() => fileRef.current?.click()}
        style={{ minHeight: H, padding: '0 20px', fontWeight: 600 }}>
        {t('wr_add_photo')}
      </button>
      <small style={{ color: 'var(--tx3)', textAlign: 'center' }}>{mode === 'reprise' ? t('wr_photo_end_hint') : t('wr_photo_hint')}</small>
    </div>
  )

  const placeField = (
    <div>
      <span style={lbl}>{t('wr_place')}</span>
      {newPlace !== null ? (
        <div style={{ display: 'flex', gap: 4 }}>
          <input autoFocus aria-label={t('wr_place_new')} placeholder={t('wr_place_new')} value={newPlace} onChange={(e) => setNewPlace(e.target.value)} style={{ ...field, flex: 1 }} />
          <button type="button" className="btn primary sm" style={{ minWidth: 44, height: H }} disabled={!newPlace.trim()} onClick={() => void addPlace()}>{t('wr_ok')}</button>
          <button type="button" className="btn ghost sm" aria-label={t('wr_cancel')} style={{ minWidth: 44, height: H }} onClick={() => setNewPlace(null)}>×</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
          <select aria-label={t('wr_place')} data-testid="work-record-place" value={placeId} style={{ ...field, flex: 1 }}
            onChange={(e) => {
              if (e.target.value === '__new') return setNewPlace('')
              touchedPlace.current = true
              setPlaceAuto(false)
              setPlaceId(e.target.value)
            }}>
            <option value="">{t('cr_place_none')}</option>
            {places.map((p) => <option key={p.id} value={String(p.id)}>{placeLabel(p)}</option>)}
            <option value="__new">{t('ps_place_new_option')}</option>
          </select>
          <button type="button" className="btn ghost sm" aria-label={t('wr_place_locate')} title={t('wr_place_locate')} style={{ width: 44, height: H, padding: 0, flexShrink: 0 }} onClick={() => locate(true)}>📍</button>
        </div>
      )}
      {placeAuto && placeId ? <small style={{ color: 'var(--sage)', fontSize: 11 }}>● {t('wr_place_auto')}</small> : null}
    </div>
  )

  const voiceBtn = (onTap: () => void, on: boolean, label: string) => (
    <button type="button" aria-pressed={on} data-testid="work-record-voice" onClick={onTap}
      style={{ width: '100%', minHeight: H, border: `1px solid color-mix(in srgb, var(--cyan) 50%, transparent)`, borderRadius: 3,
        background: on ? 'color-mix(in srgb, var(--cyan) 14%, transparent)' : 'transparent', color: 'var(--cyan)', fontFamily: 'inherit', fontSize: 14 }}>
      ● {label}
    </button>
  )

  return (
    <div data-testid="work-record-phone" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg0)', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '6px max(12px, env(safe-area-inset-right)) 6px max(12px, env(safe-area-inset-left))', borderBottom: '1px solid var(--bd)', background: 'var(--bg1)' }}>
        <span style={{ fontWeight: 700, fontSize: 16, flex: 1, minWidth: 0 }}>{t('wr_title')}</span>
        {/* A new work only: a Reprise adds to an existing work, its photos must never become a new one (flow review). */}
        {mode === 'new' ? (
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} data-testid="work-record-all-fields"
            onClick={() => {
              // The kept « Brouillon » is cleared only when this drawer loaded it (it is carried now); otherwise it stays.
              if (initialMode === 'new' && !shareInboxPrefill) clearRecordDraft()
              // Place, source, period and « peint sur » have no field in the full form: say so, never drop them silently.
              if (placeId || newPlace || sourceId || periodId || paintedOn) toast.info(t('wr_all_fields_not_carried'))
              onAllFields({
                titre, techniqueId, supportId, formatId, h, w, d, origin, foundYear, foundFinished, files,
                techniques: tech.map((r) => ({ TechniqueID: r.id, Technique: r.label })),
                supports: supp.map((r) => ({ SupportID: r.id, Support: r.label })),
                formats: fmts.map((r) => ({ FormatID: r.id, Format: r.label })),
              })
            }}>{t('wr_all_fields')}</button>
        ) : null}
        <button type="button" className="btn ghost sm" aria-label={t('wr_close')} style={{ width: 44, height: 44, padding: 0, fontSize: 20 }} onClick={close}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px max(16px, env(safe-area-inset-right)) 24px max(16px, env(safe-area-inset-left))' }}>
        <div role="group" aria-label={t('wr_mode_aria')} style={{ display: 'flex', gap: 4, padding: 3, border: '1px solid var(--bd2)', borderRadius: 4 }}>
          {modeBtn('new', t('wr_mode_new'))}
          {modeBtn('reprise', t('wr_mode_reprise'))}
        </div>

        {mode === 'new' ? (
          <>
            {pictureBox}
            <span style={lbl}>{t('wr_field_title')}</span>
            <input aria-label={t('wr_field_title')} placeholder={t('wr_untitled')} value={titre} onChange={(e) => setTitre(e.target.value)} style={field} data-testid="work-record-title" />
            <div role="group" aria-label={t('session_origin_label')}>
              <span style={lbl}>{t('session_origin_label')}</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
                {(['new', 'found'] as const).map((o) => (
                  <button key={o} type="button" className="btn ghost sm" aria-pressed={origin === o} data-testid={`work-record-origin-${o}`}
                    onClick={() => setOrigin((v) => (v === o ? '' : o))}
                    style={{ minHeight: 44, whiteSpace: 'normal', background: origin === o ? 'var(--ac)' : undefined, color: origin === o ? 'var(--bg0)' : undefined }}>
                    {t(o === 'new' ? 'session_origin_new' : 'session_origin_found')}
                  </button>
                ))}
              </div>
              {origin === 'found' ? (
                <div data-testid="work-record-found" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8, marginTop: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={lbl}>{t('wf_found_year')}</span>
                    <input aria-label={t('wf_found_year')} inputMode="numeric" maxLength={4} placeholder="1999" value={foundYear}
                      onChange={(e) => setFoundYear(e.target.value.replace(/\D/g, ''))} style={field} data-testid="work-record-found-year" />
                  </div>
                  <div role="group" aria-label={t('wf_found_finished')} style={{ minWidth: 0 }}>
                    <span style={lbl}>{t('wf_found_finished')}</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 4 }}>
                      {([true, false] as const).map((v) => (
                        <button key={String(v)} type="button" className="btn ghost sm" aria-pressed={foundFinished === v}
                          data-testid={`work-record-found-${v ? 'yes' : 'no'}`} onClick={() => setFoundFinished(v)}
                          style={{ minHeight: 44, background: foundFinished === v ? 'var(--ac)' : undefined, color: foundFinished === v ? 'var(--bg0)' : undefined }}>
                          {t(v ? 'wf_found_yes' : 'wf_found_no')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <span style={lbl}>{t('wr_field_technique')}</span>
                <LookupSelect value={techniqueId} rows={tech} onChange={setTechniqueId} onAdd={(n) => addLookup('Technique', n)} label={t('wr_field_technique')} newLabel={t('wr_new_technique')} testId="work-record-technique" />
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={lbl}>{t('wr_field_support')}</span>
                <LookupSelect value={supportId} rows={supp} onChange={setSupportId} onAdd={(n) => addLookup('Support', n)} label={t('wr_field_support')} newLabel={t('wr_new_support')} testId="work-record-support" />
              </div>
            </div>
            <span style={lbl}>{t('wr_field_dims')}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,0.8fr)', gap: 8 }}>
              <input inputMode="decimal" aria-label={t('wr_dim_h')} placeholder={t('wr_dim_h')} value={h} onChange={(e) => setH(e.target.value)} style={field} />
              <input inputMode="decimal" aria-label={t('wr_dim_w')} placeholder={t('wr_dim_w')} value={w} onChange={(e) => setW(e.target.value)} style={field} />
              <input inputMode="decimal" aria-label={t('wr_dim_d')} placeholder={t('wr_dim_d')} value={d} onChange={(e) => setD(e.target.value)} style={field} />
            </div>
            <div style={{ marginTop: 8 }}>
              <LookupSelect value={formatId} rows={fmts} onChange={setFormatId} onAdd={(n) => addLookup('Format', n)} label={t('wr_field_format')} newLabel={t('wr_new_format')} testId="work-record-format" />
            </div>
            {placeField}
            <span style={lbl}>{t('wr_field_note')}</span>
            {voiceBtn(() => setVoiceAfter((v) => !v), voiceAfter, voiceAfter ? t('wr_voice_after_on') : t('wr_voice_after'))}

            <button type="button" aria-expanded={more} onClick={() => setMore((v) => !v)} data-testid="work-record-more"
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', minHeight: 44, marginTop: 8, background: 'none', border: 'none', padding: 0, color: 'var(--tx3)', fontFamily: 'inherit', fontSize: 13, textAlign: 'left' }}>
              <span>{more ? '▾' : '▸'}</span>
              <span style={{ overflowWrap: 'anywhere' }}>{t('wr_more')}</span>
            </button>
            {more ? (
              <div>
                <span style={lbl}>{t('wr_field_source')}</span>
                <LookupSelect value={sourceId} rows={ps.sources.map((s) => ({ id: s.id, label: s.name }))} onChange={setSourceId} onAdd={addSource} label={t('wr_field_source')} newLabel={t('wr_new_source')} testId="work-record-source" />
                <span style={lbl}>{t('wr_field_period')}</span>
                <select aria-label={t('wr_field_period')} value={periodId} onChange={(e) => setPeriodId(e.target.value)} style={field} data-testid="work-record-period">
                  <option value="">{t('wr_period_auto')}</option>
                  {ps.periods.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                </select>
                <span style={lbl}>{t('wr_painted_on')}</span>
                <WorkPicker value={paintedOn} onPick={setPaintedOn} label={t('wr_painted_on')} testId="work-record-painted-on" />
              </div>
            ) : null}
          </>
        ) : (
          <>
            <span style={lbl}>{t('wr_pick_work')}</span>
            <WorkPicker value={work} onPick={setWork} label={t('wr_pick_work')} testId="work-record-reprise-work" />
            {pictureBox}
            <span style={lbl}>{t('wr_history_line')}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
              <span style={{ flexShrink: 0, fontSize: 14 }}>{t('cr_kind_resumed')} —</span>
              <input aria-label={t('wr_history_date')} value={stepDate} onChange={(e) => setStepDate(e.target.value)} style={{ ...field, flex: 1 }} data-testid="work-record-reprise-date" />
            </div>
            {placeField}
            <span style={lbl}>{t('wr_field_note')}</span>
            <textarea aria-label={t('wr_field_note')} placeholder={t('wr_note_ph')} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
              style={{ ...field, height: 72, padding: '10px 12px', resize: 'vertical' }} />
            <div style={{ marginTop: 8 }}>
              {voiceBtn(() => { if (work) setVoiceFor(work.id); else toast.error(t('wr_pick_first')) }, false, t('wr_voice_reprise'))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 10 }}>{t('wr_stage_unchanged')}</p>
          </>
        )}
      </div>

      <div style={{ flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center', padding: '10px max(12px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))', borderTop: '1px solid var(--bd)', background: 'var(--bg1)' }}>
        <button type="button" className="btn ghost" style={{ minHeight: H, padding: '0 16px' }} onClick={close}>{t('wr_cancel')}</button>
        {mode === 'new' && dirty && !pending ? (
          <button type="button" className="btn" data-testid="work-record-keep-draft" style={{ minHeight: H, padding: '0 14px' }} onClick={keepDraft}>
            {t('wr_keep_draft')}
          </button>
        ) : null}
        <button type="button" className="btn primary" data-testid="work-record-save" disabled={pending || (mode === 'reprise' && !work)}
          style={{ flex: 1, minWidth: 0, minHeight: H, fontWeight: 700 }}
          onClick={() => (mode === 'new' ? submitNew() : submitReprise())}>
          {pending ? t('wr_saving') : mode === 'new' ? t('wr_create') : work ? t('wr_add_to').replace('{id}', String(work.id)) : t('wr_add_to_none')}
        </button>
      </div>

      {voiceFor != null ? (
        <VoiceNoteSheet
          open
          defaultOeuvreId={voiceFor}
          oeuvreOptions={[]}
          onClose={() => {
            const leave = mode === 'new' || pending
            setVoiceFor(null)
            if (leave) finish(null, false)
          }}
        />
      ) : null}
    </div>
  )
}
