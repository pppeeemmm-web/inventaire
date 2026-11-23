'use client'

// Journal → a voice note's « Relier » (R1 step 7): what Notes triage did, now on the Journal entry.
// Link a voice note to a work, an idea (Recherche), a Pipeline project, a constat on its work, or add an
// opt-in dated reminder. Link, never copy: the note stays a Journal entry. Owner or admin (routeVoiceNote).

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { WorkChip } from '@/components/atelier/WorkChip'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import {
  listNoteRouteTargets,
  routeVoiceNote,
  type NoteRouteTargets,
  type VoiceNoteRoutePatch,
} from '@/app/atelier/(portal)/notes/actions'
import type { VoiceNoteLinks } from '@/app/atelier/(portal)/journal/entry-actions'

const NEW = '__new__'

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function VoiceNoteLinkPanel({
  noteId,
  links,
  onChanged,
}: {
  noteId: string
  links: VoiceNoteLinks
  onChanged: () => void
}) {
  const { t, lang } = useI18n()
  const [busy, setBusy] = useState(false)
  const [targets, setTargets] = useState<NoteRouteTargets | null>(null)
  const [conceptPick, setConceptPick] = useState('')
  const [newConceptTitle, setNewConceptTitle] = useState('')
  const [workNo, setWorkNo] = useState('')
  const [processPick, setProcessPick] = useState('')
  const [remDate, setRemDate] = useState(localToday())
  const [remLabel, setRemLabel] = useState('')

  useEffect(() => {
    let live = true
    void listNoteRouteTargets().then((r) => {
      if (live && !('error' in r)) setTargets(r)
    })
    return () => {
      live = false
    }
  }, [])

  const loc = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const concepts = useMemo(
    () => [...(targets?.concepts ?? [])].sort((a, b) => a.titre.localeCompare(b.titre, loc)),
    [targets, loc],
  )
  const processes = useMemo(
    () => [...(targets?.processes ?? [])].sort((a, b) => a.nom.localeCompare(b.nom, loc)),
    [targets, loc],
  )
  const linkedConcept = links.concept_id ? concepts.find((c) => c.id === links.concept_id) : null
  const linkedProcess = links.process_id ? processes.find((p) => p.id === links.process_id) : null
  const workId = /^\d{1,6}$/.test(workNo.trim().replace(/^#/, '')) ? Number(workNo.trim().replace(/^#/, '')) : null

  async function run(patch: VoiceNoteRoutePatch, okMsg = t('notes_triage_saved')) {
    setBusy(true)
    try {
      const res = await routeVoiceNote(noteId, patch)
      if ('error' in res) {
        toast.error(t('je_err_fmt').replace('{msg}', res.error))
        return false
      }
      if (res.createdConcept) setTargets((tg) => (tg ? { ...tg, concepts: [res.createdConcept!, ...tg.concepts] } : tg))
      toast.success(okMsg)
      onChanged()
      return true
    } finally {
      setBusy(false)
    }
  }

  const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }
  const field: React.CSSProperties = { fontSize: 16, flex: '1 1 160px', minWidth: 0, maxWidth: 360, minHeight: 44 }
  const btn: React.CSSProperties = { minHeight: 44 }
  const linked = (label: ReactNode, href: string | null, onUnlink: () => void) => (
    <div style={{ ...row, fontSize: 13 }}>
      <span style={{ overflowWrap: 'anywhere' }}>{label}</span>
      {href ? (
        <Link href={href} className="btn ghost sm" style={btn}>
          {t('notes_triage_open')}
        </Link>
      ) : null}
      <button type="button" className="btn ghost sm" disabled={busy} onClick={onUnlink} style={btn}>
        {t('notes_triage_unlink')}
      </button>
    </div>
  )

  return (
    <section
      data-testid={`voice-link-panel-${noteId}`}
      style={{ borderTop: '1px dashed var(--bd)', marginTop: 10, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', margin: 0 }}>
        {t('je_voice_link_intro')}
      </p>

      {/* Œuvre */}
      <div>
        <div className="t-label" style={{ marginBottom: 6 }}>{t('notes_triage_work')}</div>
        {links.oeuvre_id != null ? (
          linked(<WorkChip id={links.oeuvre_id} size="chip" />, `/atelier/inventory?work=${links.oeuvre_id}`, () => void run({ oeuvre_id: null }))
        ) : (
          <div style={row}>
            <input
              className="input"
              inputMode="numeric"
              style={field}
              value={workNo}
              onChange={(e) => setWorkNo(e.target.value)}
              placeholder={t('je_voice_link_work_ph')}
              aria-label={t('notes_triage_work')}
              data-testid={`voice-link-work-${noteId}`}
            />
            <button
              type="button"
              className="btn sm"
              disabled={busy || workId == null}
              onClick={() => void run({ oeuvre_id: workId }).then((ok) => { if (ok) setWorkNo('') })}
              style={btn}
            >
              {t('notes_triage_link')}
            </button>
          </div>
        )}
      </div>

      {/* Idée (concept) */}
      <div>
        <div className="t-label" style={{ marginBottom: 6 }}>{t('je_voice_link_idea')}</div>
        {links.concept_id ? (
          linked(linkedConcept?.titre ?? links.concept_id.slice(0, 8), `/atelier/concepts?concept=${links.concept_id}`, () => void run({ concept_id: null }))
        ) : (
          <div style={row}>
            <select
              className="input"
              style={field}
              value={conceptPick}
              onChange={(e) => setConceptPick(e.target.value)}
              aria-label={t('je_voice_link_idea')}
            >
              <option value="">{t('je_voice_link_idea_ph')}</option>
              <option value={NEW}>{t('je_voice_link_idea_new')}</option>
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
              style={btn}
              disabled={busy || !conceptPick || (conceptPick === NEW && !(newConceptTitle.trim() || links.subject?.trim()))}
              onClick={() =>
                void run(
                  conceptPick === NEW
                    ? { new_concept_title: newConceptTitle.trim() || links.subject?.trim() || '' }
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

      {/* Projet */}
      <div>
        <div className="t-label" style={{ marginBottom: 6 }}>{t('notes_triage_process')}</div>
        {links.process_id ? (
          linked(linkedProcess?.nom ?? links.process_id.slice(0, 8), `/atelier/pipeline?process=${links.process_id}`, () => void run({ process_id: null }))
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
              style={btn}
              disabled={busy || !processPick}
              onClick={() => void run({ process_id: processPick }).then((ok) => { if (ok) setProcessPick('') })}
            >
              {t('notes_triage_link')}
            </button>
          </div>
        )}
      </div>

      {/* Constat — on the linked work, the note's text as its notes */}
      <div>
        <div className="t-label" style={{ marginBottom: 6 }}>{t('notes_triage_constat')}</div>
        {links.condition_report_id != null ? (
          linked(
            t('notes_triage_constat_linked_fmt')
              .replace('{id}', String(links.condition_report_id))
              .replace('{work}', String(links.oeuvre_id ?? '—')),
            links.oeuvre_id != null ? `/atelier/inventory?work=${links.oeuvre_id}` : null,
            () => void run({ condition_report_id: null }),
          )
        ) : links.oeuvre_id != null ? (
          <button
            type="button"
            className="btn sm"
            style={{ ...btn, alignSelf: 'flex-start' }}
            disabled={busy}
            onClick={() => void run({ new_condition_report: true }, t('notes_triage_constat_created'))}
          >
            {t('notes_triage_constat_create_fmt').replace('{id}', String(links.oeuvre_id))}
          </button>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--tx3)', margin: 0 }}>{t('notes_triage_constat_needs_work')}</p>
        )}
      </div>

      {/* Rappel daté — opt-in */}
      <div>
        <div className="t-label" style={{ marginBottom: 6 }}>{t('notes_triage_reminder')}</div>
        <div style={row}>
          <input
            type="date"
            className="input"
            style={{ ...field, flex: '0 1 170px' }}
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
            style={btn}
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
    </section>
  )
}
