'use client'

// Spheres of one person (People.md §1): chips + an inline panel of toggles. Reads / writes through the
// doors in contacts/people-actions.ts (set_contact_spheres); a refusal is explained, nothing is guessed.

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { readContactSpheres, setContactSpheres, type Sphere } from '@/app/atelier/(portal)/contacts/people-actions'

const CHIP: React.CSSProperties = {
  border: '1px solid var(--bd)',
  color: 'var(--tx2)',
  fontSize: 10,
  padding: '1px 6px',
  borderRadius: 2,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  background: 'none',
}

const REFUSED: Record<string, DictKey> = {
  forbidden: 'pp_refused_forbidden' as DictKey,
  not_found: 'pp_refused_not_found' as DictKey,
  bad_field: 'pp_refused_bad_field' as DictKey,
}

export function PersonSpheres({
  contactId,
  narrow,
  onChanged,
  onPendingChange,
}: {
  contactId: number
  narrow: boolean
  onChanged?: (spheres: string[]) => void
  /** True while the open draft differs from the saved spheres. */
  onPendingChange?: (pending: boolean) => void
}) {
  const { t, lang } = useI18n()
  const [all, setAll] = useState<Sphere[]>([])
  const [mine, setMine] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setLoading(true)
    setFailed(false)
    setOpen(false)
    setRefused(null)
    void readContactSpheres(contactId).then((res) => {
      if (!live) return
      if ('ok' in res) {
        setAll(res.all)
        setMine(res.mine)
      } else {
        setAll([])
        setMine([])
        setFailed(true)
      }
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [contactId])

  const pending = open && (draft.length !== mine.length || draft.some((k) => !mine.includes(k)))
  const pendingCb = useRef(onPendingChange)
  pendingCb.current = onPendingChange
  useEffect(() => {
    pendingCb.current?.(pending)
  }, [pending])
  useEffect(() => () => pendingCb.current?.(false), [])

  const label = (s: Sphere) => (lang === 'en' ? s.en : s.fr)
  const shown = all.filter((s) => mine.includes(s.key))
  const minH = narrow ? 44 : undefined

  const save = async () => {
    setBusy(true)
    setRefused(null)
    const res = await setContactSpheres(contactId, draft)
    setBusy(false)
    if ('ok' in res) {
      if (res.spheres) setMine(res.spheres)
      setOpen(false)
      onChanged?.(res.spheres ?? draft)
    } else if ('unchanged' in res) {
      setOpen(false)
    } else {
      setRefused(res.refused)
    }
  }

  return (
    <div data-testid="person-spheres" style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {loading ? <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('pp_loading')}</span> : null}
        {shown.map((s) => (
          <span key={s.key} style={CHIP}>{label(s)}</span>
        ))}
        {failed ? <span style={{ fontSize: 12, color: 'var(--rust)' }}>{t('pp_refused_error')}</span> : null}
        {!loading && !failed ? (
          <button
            type="button"
            className="btn ghost sm"
            aria-expanded={open}
            onClick={() => {
              setDraft(mine)
              setRefused(null)
              setOpen((v) => !v)
            }}
            style={{ minHeight: minH }}
          >
            {t('pp_spheres_edit')}
          </button>
        ) : null}
      </div>
      {open ? (
        <div style={{ marginTop: 8, border: '1px solid var(--bd)', borderRadius: 4, padding: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {all.map((s) => {
              const on = draft.includes(s.key)
              return (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDraft((d) => (d.includes(s.key) ? d.filter((k) => k !== s.key) : [...d, s.key]))}
                  style={{
                    ...CHIP,
                    minHeight: narrow ? 44 : 28,
                    padding: '0 10px',
                    cursor: 'pointer',
                    color: on ? 'var(--tx)' : 'var(--tx2)',
                    borderColor: on ? 'var(--ac)' : 'var(--bd)',
                    fontWeight: on ? 600 : 400,
                  }}
                >
                  {label(s)}
                </button>
              )
            })}
          </div>
          {refused ? (
            <div role="alert" style={{ fontSize: 12, color: 'var(--rust)', marginTop: 6 }}>
              {t(REFUSED[refused] ?? ('pp_refused_error' as DictKey))}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn sm" disabled={busy} onClick={() => void save()} style={{ minHeight: minH }}>
              {busy ? t('pp_loading') : t('pp_spheres_save')}
            </button>
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => setOpen(false)} style={{ minHeight: minH }}>
              {t('pp_cancel')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
