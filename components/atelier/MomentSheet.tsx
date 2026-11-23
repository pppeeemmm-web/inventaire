'use client'

// « + Moment » sheet (People.md §6): dictate first, kind chips, date, the line with @ / #. Saves through saveMoment.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { saveMoment, type MomentKind } from '@/app/atelier/(portal)/contacts/moment-actions'
import { useLinkPicker } from '@/components/journal/LinkPicker'
import { useI18n } from '@/lib/i18n/context'
import { getLiveDictationAvailability, startLiveDictation, type LiveDictationSession } from '@/lib/voice/web-speech'
import { toast } from '@/lib/ui/toast'
import { surfaceError } from '@/lib/error-reporter/client'

const KINDS: MomentKind[] = ['call', 'studio_visit', 'meeting', 'mail_in', 'mail_out', 'introduction', 'press', 'thanks', 'other']
type Precision = 'day' | 'month' | 'year'
const REFUSALS = ['forbidden', 'admin_only', 'bad_field', 'not_found', 'stale']

function localToday(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function applyPrecision(date: string, precision: Precision): string {
  if (precision === 'month') return `${date.slice(0, 7)}-01`
  if (precision === 'year') return `${date.slice(0, 4)}-01-01`
  return date
}

export function MomentSheet({
  open,
  onClose,
  contactId,
  contactName,
  narrow,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  contactId: number | null
  contactName?: string
  narrow: boolean
  onSaved?: (id: number) => void
}) {
  const { t, tDynamic, lang } = useI18n()
  const [kind, setKind] = useState<MomentKind>('call')
  const [date, setDate] = useState(localToday)
  const [precision, setPrecision] = useState<Precision>('day')
  const [summary, setSummary] = useState('')
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [dictating, setDictating] = useState(false)
  const [interim, setInterim] = useState('')
  const session = useRef<LiveDictationSession | null>(null)
  const picker = useLinkPicker(summary, setSummary)
  const [canDictate, setCanDictate] = useState(false)

  useEffect(() => {
    setCanDictate(getLiveDictationAvailability() === 'ready')
  }, [])

  const stopDictation = useCallback(() => {
    session.current?.stop()
    session.current = null
    setDictating(false)
    setInterim('')
  }, [])

  useEffect(() => () => session.current?.stop(), [])

  const people = picker.links.filter((l) => l.kind === 'contact').map((l) => Number(l.id))
  const works = picker.links.filter((l) => l.kind === 'oeuvre').map((l) => Number(l.id))
  const allPeople = contactId != null ? Array.from(new Set([contactId, ...people])) : Array.from(new Set(people))
  const dirty = summary.trim() !== '' || picker.links.length > 0

  const reset = useCallback(() => {
    setKind('call')
    setDate(localToday())
    setPrecision('day')
    setSummary('')
    setRefusal(null)
    picker.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker.clear])

  const close = useCallback(() => {
    if (saving) return
    if (dirty && !window.confirm(t('mm_discard_confirm'))) return
    stopDictation()
    reset()
    onClose()
  }, [saving, dirty, t, stopDictation, reset, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  async function toggleDictation() {
    if (dictating) {
      stopDictation()
      return
    }
    const s = await startLiveDictation(lang === 'fr' ? 'fr-FR' : 'en-GB', {
      onInterim: (text) => setInterim(text),
      onFinal: (text) => {
        setInterim('')
        setSummary((prev) => (prev && !/\s$/.test(prev) ? `${prev} ${text.trim()}` : `${prev}${text.trim()}`))
      },
      onError: (code) => {
        stopDictation()
        toast.error(t('mm_dictate_err_fmt').replace('{msg}', code))
      },
    })
    if (s.ok) {
      session.current = s
      setDictating(true)
    }
  }

  async function save() {
    if (saving || allPeople.length + works.length === 0) return
    stopDictation()
    setSaving(true)
    setRefusal(null)
    try {
      const res = await saveMoment({
        happenedOn: applyPrecision(date, precision),
        precision,
        kind,
        summary: summary.trim(),
        people: allPeople.map((id) => ({ contactId: id })),
        works,
      })
      if ('ok' in res) {
        reset()
        onClose()
        onSaved?.(res.id)
      } else {
        setRefusal(tDynamic(REFUSALS.includes(res.refused) ? `mm_refused_${res.refused}` : 'mm_refused_error'))
      }
    } catch (e) {
      surfaceError(t('mm_refused_error'), e, { source: 'MomentSheet' })
      setRefusal(t('mm_refused_error'))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const panel: CSSProperties = narrow
    ? { position: 'fixed', left: 0, right: 0, bottom: 0, width: '100%', maxHeight: '85vh', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', borderRadius: '14px 14px 0 0' }
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'calc(100% - 32px)', maxWidth: 560, maxHeight: '85vh', paddingBottom: 16, borderRadius: 12 }
  const field: CSSProperties = { minHeight: 44, boxSizing: 'border-box', border: '1px solid var(--bd2, var(--bd))', background: 'var(--bg0)', color: 'var(--tx)', font: 'inherit', fontSize: 15, padding: '6px 10px', borderRadius: 8 }
  const lbl: CSSProperties = { fontSize: 12, color: 'var(--tx3)' }
  const canSave = !saving && allPeople.length + works.length > 0

  return (
    <>
      <div onClick={close} data-testid="moment-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000 }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('mm_title')}
        data-testid="moment-sheet"
        style={{ ...panel, zIndex: 1001, background: 'var(--bg0)', border: '1px solid var(--bd)', boxSizing: 'border-box', padding: 16, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div style={{ fontSize: 16, fontWeight: 600 }}>{t('mm_title')}</div>

        {canDictate ? (
          <button
            type="button"
            onClick={() => void toggleDictation()}
            style={{ ...field, cursor: 'pointer', fontWeight: 600, color: dictating ? 'var(--bg0)' : '#b3261e', background: dictating ? '#b3261e' : 'var(--bg0)' }}
          >
            {dictating ? t('mm_dictate_stop') : t('mm_dictate')}
          </button>
        ) : null}
        {interim ? <div style={{ fontSize: 13, color: 'var(--tx3)' }}>{interim}</div> : null}

        <div role="radiogroup" aria-label={t('mm_kind_label')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {KINDS.map((k) => {
            const on = k === kind
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setKind(k)}
                style={{ minHeight: 44, padding: '0 14px', borderRadius: 22, cursor: 'pointer', font: 'inherit', fontSize: 14, border: '1px solid var(--bd2, var(--bd))', background: on ? 'var(--ac)' : 'var(--bg0)', color: on ? 'var(--bg0)' : 'var(--tx)' }}
              >
                {tDynamic(`mm_kind_${k}`)}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 140px', minWidth: 0 }}>
            <span style={lbl}>{t('mm_date')}</span>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={field} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 120px', minWidth: 0 }}>
            <span style={lbl}>{t('mm_precision')}</span>
            <select value={precision} onChange={(e) => setPrecision(e.target.value as Precision)} style={field}>
              <option value="day">{t('mm_precision_day')}</option>
              <option value="month">{t('mm_precision_month')}</option>
              <option value="year">{t('mm_precision_year')}</option>
            </select>
          </label>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={lbl}>{t('mm_summary')}</span>
          <textarea
            value={summary}
            rows={5}
            placeholder={t('mm_summary_ph')}
            onChange={(e) => {
              setSummary(e.target.value)
              picker.onChange(e)
            }}
            onKeyDown={(e) => {
              picker.onKeyDown(e)
            }}
            onClick={picker.onChange}
            onKeyUp={picker.onCaret}
            style={{ ...field, width: '100%', resize: 'vertical' }}
          />
        </label>
        {picker.popover}

        <div aria-label={t('mm_people')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
          {contactId != null && contactName ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 36, maxWidth: '100%', border: '1px solid var(--bd2, var(--bd))', borderRadius: 18, padding: '0 12px', fontSize: 13, color: 'var(--tx2)' }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{contactName}</span>
            </span>
          ) : null}
        </div>
        {picker.chips}

        {refusal ? (
          <div role="alert" style={{ color: '#b3261e', fontSize: 14 }}>
            {refusal}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={close} disabled={saving} style={{ ...field, cursor: 'pointer', padding: '0 16px' }}>
            {t('mm_cancel')}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave}
            style={{ ...field, cursor: canSave ? 'pointer' : 'default', padding: '0 16px', fontWeight: 600, background: 'var(--ac)', color: 'var(--bg0)', border: 'none', opacity: canSave ? 1 : 0.5 }}
          >
            {saving ? t('mm_saving') : t('mm_save')}
          </button>
        </div>
      </div>
    </>
  )
}
