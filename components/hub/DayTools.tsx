'use client'

// Day screen tools (docs/design/2026-11-18/PhoneNav.notes.md, shared fix 1): what the phone Journal day
// page did with an entry, now on Aujourd'hui — « Relier » / « Supprimer » a voice note, hide / verify an
// entry (admin), and the admin « Modifier la séance ». Same server actions and rules as the Journal.
// Its own chunk: loaded only when « ⋯ » or « Modifier la séance » is tapped.
import { useState, useTransition, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { VoiceNoteLinkPanel } from '@/components/atelier/journal/VoiceNoteLinkPanel'
import { EntryCorrectAction, canCorrectEntry } from '@/components/atelier/journal/EntryCorrection'
import { deleteVoiceNote } from '@/app/atelier/(portal)/notes/actions'
import {
  setJournalEntryHidden,
  type JournalDayEntry,
  type JournalDayVoice,
  type VoiceNoteLinks,
} from '@/app/atelier/(portal)/journal/entry-actions'
import { updateWorkSessionJournalMetadata } from '@/app/atelier/session/actions'
import { sessionAtIsoForCalendarDay } from '@/lib/session-calendar-day'

const btn: CSSProperties = { minHeight: 44 }

/** The tools of one entry (or of a voice note no transcript entry carries yet). */
export function DayEntryTools({ entry, voice, isAdmin }: { entry?: JournalDayEntry; voice?: JournalDayVoice; isAdmin: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [linkOpen, setLinkOpen] = useState(false)
  const [asking, setAsking] = useState(false)

  const noteId = voice?.id ?? entry?.voiceNoteId ?? null
  const links: VoiceNoteLinks | null = voice
    ? { subject: voice.subject, oeuvre_id: voice.oeuvre_id, concept_id: voice.concept_id, process_id: voice.process_id, condition_report_id: voice.condition_report_id }
    : entry?.voiceLinks ?? null
  // The author or an admin for a note no entry carries yet; an admin once a transcript entry carries it.
  const canDelete = voice ? voice.mine || isAdmin : isAdmin && !!entry && !entry.hidden

  function run(fn: () => Promise<{ ok: true } | { error: string }>, done?: string) {
    startTransition(async () => {
      const res = await fn()
      if ('error' in res) {
        toast.error(res.error === 'admin_only' ? t('je_voice_delete_admin') : t('je_err_fmt').replace('{msg}', res.error))
        return
      }
      if (done) toast.success(done)
      setAsking(false)
      router.refresh()
    })
  }

  return (
    <div data-testid="day-entry-tools" style={{ display: 'grid', gap: 8, marginTop: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {noteId && links ? (
          <button type="button" className="btn ghost sm" aria-expanded={linkOpen} onClick={() => setLinkOpen((v) => !v)} style={btn}>
            {t(linkOpen ? 'je_voice_link_close' : 'je_voice_link')}
          </button>
        ) : null}
        {entry && isAdmin && canCorrectEntry(entry) ? <EntryCorrectAction entry={entry} onDone={() => router.refresh()} /> : null}
        {entry && isAdmin ? (
          <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => setJournalEntryHidden(entry.id, !entry.hidden))} style={btn}>
            {t(entry.hidden ? 'je_unhide' : 'je_hide')}
          </button>
        ) : null}
        {noteId && canDelete && !asking ? (
          <button type="button" className="btn ghost sm" disabled={pending} onClick={() => setAsking(true)} style={btn}>
            {t('je_voice_delete')}
          </button>
        ) : null}
      </div>
      {asking && noteId ? (
        <div role="alertdialog" aria-label={t('je_voice_delete')} style={{ padding: 10, border: '1px solid var(--rust)', borderRadius: 8, display: 'grid', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>{t(voice ? 'je_voice_delete_ask' : 'je_voice_delete_ask_entry')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="btn sm" disabled={pending} onClick={() => run(() => deleteVoiceNote(noteId), t('je_voice_deleted'))} style={{ ...btn, color: 'var(--rust)', borderColor: 'var(--rust)' }}>
              {t('je_voice_delete_yes')}
            </button>
            <button type="button" className="btn ghost sm" disabled={pending} onClick={() => setAsking(false)} style={btn}>
              {t('je_voice_delete_no')}
            </button>
          </div>
        </div>
      ) : null}
      {linkOpen && noteId && links ? <VoiceNoteLinkPanel noteId={noteId} links={links} onChanged={() => router.refresh()} /> : null}
    </div>
  )
}

/** Admin « Modifier la séance »: the field session's date and note (the Journal day page's form). */
export function DaySessionEdit({ sessionId, day, notes, onDone }: { sessionId: string; day: string; notes: string; onDone: () => void }) {
  const { t } = useI18n()
  const router = useRouter()
  const [date, setDate] = useState(day)
  const [text, setText] = useState(notes)
  const [pending, startTransition] = useTransition()

  function save() {
    const sessionAt = sessionAtIsoForCalendarDay(date)
    if (!sessionAt) {
      toast.error(t('session_toast_error'))
      return
    }
    startTransition(async () => {
      const res = await updateWorkSessionJournalMetadata(sessionId, { session_at: sessionAt, notes: text })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(date === day ? t('session_toast_saved') : t('pn_session_moved').replace('{day}', date))
      onDone()
      if (date === day) router.refresh()
      else router.push(`/hub?day=${date}`)
    })
  }

  const field: CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: 44, fontSize: 16, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--bd2)', background: 'var(--bg1)', color: 'var(--tx)' }
  return (
    <div data-testid="day-session-edit" style={{ display: 'grid', gap: 10 }}>
      <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--tx3)' }}>
        {t('session_date_label')}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={field} />
      </label>
      <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--tx3)' }}>
        {t('session_notes_label')}
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} style={{ ...field, lineHeight: 1.45 }} />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn primary" disabled={pending} onClick={save} style={{ minHeight: 44, flex: 1 }}>
          {t('save')}
        </button>
        <button type="button" className="btn ghost" disabled={pending} onClick={onDone} style={{ minHeight: 44, flex: 1 }}>
          {t('cancel')}
        </button>
      </div>
    </div>
  )
}
