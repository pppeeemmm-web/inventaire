'use client'

// Notes → Trier: link a voice note to a Recherche concept (existing or new), a work,
// a Pipeline project, or add an opt-in dated reminder. Link, never copy — the note stays.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import type { Oeuvre, VoiceNoteRow } from '@/lib/types/database'
import {
  routeVoiceNote,
  type NoteRouteTargets,
  type RouteVoiceNoteResult,
  type VoiceNoteRoutePatch,
} from '@/app/atelier/(portal)/notes/actions'

const NEW = '__new__'

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function NoteTriagePanel({
  note,
  oeuvres,
  targets,
  onRouted,
}: {
  note: VoiceNoteRow
  oeuvres: Oeuvre[]
  targets: NoteRouteTargets | null
  onRouted: (row: RouteVoiceNoteResult['row'], createdConcept?: RouteVoiceNoteResult['createdConcept']) => void
}) {
  const { t, lang } = useI18n()
  const [busy, setBusy] = useState(false)
  const [conceptPick, setConceptPick] = useState('')
  const [newConceptTitle, setNewConceptTitle] = useState('')
  const [workQ, setWorkQ] = useState('')
  const [processPick, setProcessPick] = useState('')
  const [remDate, setRemDate] = useState(localToday())
  const [remLabel, setRemLabel] = useState('')

  const loc = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const concepts = useMemo(
    () => [...(targets?.concepts ?? [])].sort((a, b) => a.titre.localeCompare(b.titre, loc)),
    [targets, loc],
  )
  const processes = useMemo(
    () => [...(targets?.processes ?? [])].sort((a, b) => a.nom.localeCompare(b.nom, loc)),
    [targets, loc],
  )
  const linkedConcept = note.concept_id ? concepts.find((c) => c.id === note.concept_id) : null
  const linkedProcess = note.process_id ? processes.find((p) => p.id === note.process_id) : null
  const linkedWork = note.oeuvre_id != null ? oeuvres.find((o) => o.OeuvreID === note.oeuvre_id) : null

  const workMatches = useMemo(() => {
    const q = workQ.trim().toLowerCase()
    if (!q) return []
    return oeuvres
      .filter((o) => String(o.OeuvreID).startsWith(q) || (o.Titre ?? '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [workQ, oeuvres])

  async function run(patch: VoiceNoteRoutePatch, okMsg = t('notes_triage_saved')) {
    setBusy(true)
    try {
      const res = await routeVoiceNote(note.id, patch)
      if ('error' in res) {
        toast.error(`${t('error_prefix')} ${res.error}`)
        return false
      }
      onRouted(res.row, res.createdConcept)
      toast.success(okMsg)
      return true
    } finally {
      setBusy(false)
    }
  }

  const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }
  const linkedBox: React.CSSProperties = { ...row, fontSize: 13 }
  const field: React.CSSProperties = { fontSize: 12, flex: 1, minWidth: 160, maxWidth: 360 }

  return (
    <section
      data-testid="notes-triage"
      style={{ borderTop: '1px solid var(--bd)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div className="t-eyebrow">{t('notes_triage_heading')}</div>
        <span className="t-mono-sm" style={{ fontSize: 10, color: note.routed_at ? 'var(--tx3)' : 'var(--rust)' }}>
          {note.routed_at
            ? t('notes_triage_sorted_fmt').replace('{date}', new Date(note.routed_at).toLocaleDateString(loc))
            : t('notes_triage_unsorted_badge')}
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--tx2)', margin: 0 }}>{t('notes_triage_intro')}</p>

      {/* Recherche */}
      <div>
        <div className="t-label" style={{ marginBottom: 6 }}>{t('notes_triage_concept')}</div>
        {note.concept_id ? (
          <div style={linkedBox}>
            <span>{linkedConcept?.titre ?? note.concept_id.slice(0, 8)}</span>
            <Link href="/atelier/concepts" className="btn ghost sm">{t('notes_triage_open')}</Link>
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => void run({ concept_id: null })}>
              {t('notes_triage_unlink')}
            </button>
          </div>
        ) : (
          <div style={row}>
            <select
              className="input"
              style={field}
              value={conceptPick}
              onChange={(e) => setConceptPick(e.target.value)}
              aria-label={t('notes_triage_concept')}
            >
              <option value="">{t('notes_triage_concept_ph')}</option>
              <option value={NEW}>{t('notes_triage_concept_new')}</option>
              {concepts.map((c) => (
                <option key={c.id} value={c.id}>{c.titre}</option>
              ))}
            </select>
            {conceptPick === NEW ? (
              <input
                className="input"
                style={field}
                value={newConceptTitle}
                onChange={(e) => setNewConceptTitle(e.target.value)}
                placeholder={t('notes_triage_concept_new_ph')}
                aria-label={t('notes_triage_concept_new_ph')}
              />
            ) : null}
            <button
              type="button"
              className="btn sm"
              disabled={busy || !conceptPick || (conceptPick === NEW && !(newConceptTitle.trim() || note.subject?.trim()))}
              onClick={() =>
                void run(
                  conceptPick === NEW
                    ? { new_concept_title: newConceptTitle.trim() || note.subject?.trim() || '' }
                    : { concept_id: conceptPick },
                ).then((ok) => {
                  if (ok) {
                    setConceptPick('')
                    setNewConceptTitle('')
                  }
                })
              }
            >
              {t('notes_triage_link')}
            </button>
          </div>
        )}
      </div>

      {/* Œuvre */}
      <div>
        <div className="t-label" style={{ marginBottom: 6 }}>{t('notes_triage_work')}</div>
        {note.oeuvre_id != null ? (
          <div style={linkedBox}>
            <span>#{note.oeuvre_id}{linkedWork?.Titre ? ` · ${linkedWork.Titre}` : ''}</span>
            <Link href={`/atelier/inventory?work=${note.oeuvre_id}`} className="btn ghost sm">{t('notes_triage_open')}</Link>
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => void run({ oeuvre_id: null })}>
              {t('notes_triage_unlink')}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 420 }}>
            <input
              className="input"
              style={{ fontSize: 12 }}
              value={workQ}
              onChange={(e) => setWorkQ(e.target.value)}
              placeholder={t('notes_triage_work_ph')}
              aria-label={t('notes_triage_work')}
            />
            {workMatches.map((o) => (
              <button
                key={o.OeuvreID}
                type="button"
                className="btn ghost sm"
                disabled={busy}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                onClick={() => void run({ oeuvre_id: o.OeuvreID }).then((ok) => { if (ok) setWorkQ('') })}
              >
                #{o.OeuvreID} · {o.Titre?.trim() || '—'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Projet */}
      <div>
        <div className="t-label" style={{ marginBottom: 6 }}>{t('notes_triage_process')}</div>
        {note.process_id ? (
          <div style={linkedBox}>
            <span>{linkedProcess?.nom ?? note.process_id.slice(0, 8)}</span>
            <Link href={`/atelier/pipeline?process=${note.process_id}`} className="btn ghost sm">{t('notes_triage_open')}</Link>
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => void run({ process_id: null })}>
              {t('notes_triage_unlink')}
            </button>
          </div>
        ) : (
          <div style={row}>
            <select
              className="input"
              style={field}
              value={processPick}
              onChange={(e) => setProcessPick(e.target.value)}
              aria-label={t('notes_triage_process')}
            >
              <option value="">{t('notes_triage_process_ph')}</option>
              {processes.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}{p.type ? ` · ${p.type}` : ''}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn sm"
              disabled={busy || !processPick}
              onClick={() => void run({ process_id: processPick }).then((ok) => { if (ok) setProcessPick('') })}
            >
              {t('notes_triage_link')}
            </button>
          </div>
        )}
      </div>

      {/* Rappel daté — opt-in only */}
      <div>
        <div className="t-label" style={{ marginBottom: 6 }}>{t('notes_triage_reminder')}</div>
        <div style={row}>
          <input
            type="date"
            className="input"
            style={{ fontSize: 12 }}
            value={remDate}
            onChange={(e) => setRemDate(e.target.value)}
            aria-label={t('notes_triage_reminder')}
          />
          <input
            className="input"
            style={field}
            value={remLabel}
            onChange={(e) => setRemLabel(e.target.value)}
            placeholder={t('notes_triage_reminder_label_ph')}
            aria-label={t('notes_triage_reminder_label_ph')}
          />
          <button
            type="button"
            className="btn sm"
            disabled={busy || !remDate}
            onClick={() =>
              void run({ reminder: { date: remDate, label: remLabel } }, t('notes_triage_reminder_added')).then((ok) => {
                if (ok) setRemLabel('')
              })
            }
          >
            {t('notes_triage_reminder_add')}
          </button>
        </div>
      </div>

      <div style={{ ...row, justifyContent: 'space-between' }}>
        <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('notes_triage_coming')}</span>
        {note.routed_at ? (
          <button type="button" className="btn ghost sm" disabled={busy} onClick={() => void run({ routed: false })}>
            {t('notes_triage_back_to_sort')}
          </button>
        ) : (
          <button type="button" className="btn ghost sm" disabled={busy} onClick={() => void run({ routed: true })}>
            {t('notes_triage_keep')}
          </button>
        )}
      </div>
    </section>
  )
}
