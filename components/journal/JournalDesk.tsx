'use client'

// The desk face of the Journal stream (design docs/design/2026-11-22/JournalDesign.md §4 desk, mockup
// Journal_Mockup.html): toolbar (Jours / Mois / Années, « aller au »), the same stream and cards as the
// phone, wide, and on the right the rail — what the clicked card is connected to (its works and the other
// days that mention them, its ✦ suggestions, its ideas). Today ends with a composer. Shown in the Journal
// tab while the switch is on (`?stream=1`, a cookie; `?stream=0` goes back).

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { thumbUrl } from '@/lib/data'
import { foregroundSettled } from '@/lib/atelier/foreground-gate'
import { createJournalEntry } from '@/app/atelier/(portal)/journal/entry-actions'
import { JournalScaleSwitch, JournalStream, type JournalSelection } from '@/components/journal/JournalStream'
import { JournalStreamSwitchKeeper } from '@/components/journal/JournalPhone'
import { MAIN_ACTION_STYLE } from '@/lib/ui/main-action'
import type { JournalStreamPage, JournalWorkMentions } from '@/lib/journal/stream'

type Scale = 0 | 1 | 2

const railHead: CSSProperties = { fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--tx3)', margin: '16px 0 6px' }
const railEmpty: CSSProperties = { color: 'var(--tx3)', fontSize: 13, margin: 0 }

function Pic({ file, size }: { file: string | null; size: number }) {
  const src = thumbUrl(file)
  const style: CSSProperties = { width: size, height: size, borderRadius: 6, flex: 'none', objectFit: 'cover', background: 'var(--bg3)' }
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" loading="lazy" style={style} /> : <span aria-hidden="true" style={{ ...style, display: 'inline-block' }} />
}

/** One work in the rail: its picture, title, and the other days that mention it (clickable). */
function RailWork({ id, day, onJump }: { id: number; day: string; onJump: (day: string) => void }) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const [data, setData] = useState<JournalWorkMentions | null>(null)
  useEffect(() => {
    let alive = true
    void fetch(`/api/journal/stream?work=${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: JournalWorkMentions | null) => {
        if (alive) setData(j)
      })
    return () => {
      alive = false
    }
  }, [id])
  const others = [...new Set((data?.mentions ?? []).map((m) => m.day).filter((d) => d !== day))]
  const short = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', day: 'numeric', month: 'short', year: d.slice(0, 4) === day.slice(0, 4) ? undefined : 'numeric' })
  return (
    <div data-testid={`js-rail-work-${id}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--bd)' }}>
      <a href={`/atelier/inventory?work=${id}`} style={{ flex: 'none' }}>
        <Pic file={data?.thumb ?? null} size={48} />
      </a>
      <div style={{ minWidth: 0, fontSize: 13 }}>
        <a href={`/atelier/inventory?work=${id}`} style={{ color: 'var(--tx)', textDecoration: 'none' }}>
          {data?.title ?? `#${id}`} <span style={{ color: 'var(--tx3)' }}>#{id}</span>
        </a>
        <div style={{ color: 'var(--tx3)', fontSize: 12, marginTop: 2 }}>
          {data == null ? '…' : others.length ? (
            <>
              {t('js_rail_also')}{' '}
              {others.slice(0, 8).map((d, i) => (
                <span key={d}>
                  {i ? ', ' : ''}
                  <button type="button" onClick={() => onJump(d)} style={{ background: 'none', border: 0, padding: 0, color: 'var(--ac)', cursor: 'pointer', font: 'inherit' }}>
                    {short(d)}
                  </button>
                </span>
              ))}
              {others.length > 8 ? ` +${others.length - 8}` : ''}
            </>
          ) : (
            t('js_rail_only_day')
          )}
        </div>
      </div>
    </div>
  )
}

function Rail({ sel, onJump }: { sel: JournalSelection | null; onJump: (day: string) => void }) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  if (!sel) return <p style={railEmpty}>{t('js_rail_empty')}</p>
  const when = new Date(`${sel.day}T12:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const time = sel.kind === 'session' ? '' : ` · ${new Date(sel.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}`
  return (
    <div data-testid="js-rail">
      <h3 style={{ ...railHead, marginTop: 0 }}>{t('js_rail_card')}</h3>
      <div style={{ fontSize: 13, color: 'var(--tx2)' }}>
        {when}
        {time}
      </div>
      {sel.text ? <p style={{ fontSize: 13, color: 'var(--tx3)', margin: '4px 0 0', overflowWrap: 'anywhere' }}>{sel.text.length > 160 ? `${sel.text.slice(0, 160)}…` : sel.text}</p> : null}
      <h3 style={railHead}>{t('js_rail_works')}</h3>
      {sel.works.length ? sel.works.map((w) => <RailWork key={w.id} id={w.id} day={sel.day} onJump={onJump} />) : <p style={railEmpty}>{t('js_rail_none_works')}</p>}
      {sel.proposals.length ? (
        <>
          <h3 style={railHead}>{t('js_rail_suggestions')}</h3>
          {sel.proposals.map((p) => (
            <div key={p.linkId} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--bd)', fontSize: 13 }}>
              {p.workId != null ? <Pic file={p.thumb} size={28} /> : <span aria-hidden="true">✦</span>}
              <span style={{ minWidth: 0 }}>{p.title ?? '—'}</span>
            </div>
          ))}
        </>
      ) : null}
      <h3 style={railHead}>{t('js_rail_suites')}</h3>
      <p style={railEmpty}>{t('js_rail_suites_later')}</p>
      <h3 style={railHead}>{t('js_rail_ideas')}</h3>
      {sel.concepts.length ? (
        sel.concepts.map((c) => (
          <a key={c.id} href={`/atelier/concepts?concept=${c.id}`} style={{ display: 'block', padding: '4px 0', fontSize: 13, color: 'var(--ac)' }}>
            ✦ {c.title ?? '—'}
          </a>
        ))
      ) : (
        <p style={railEmpty}>{t('js_rail_none')}</p>
      )}
    </div>
  )
}

/** Today's composer: Enter (or « Ajouter ») writes a note on today; `#1234` links a work. */
function Composer({ today, onAdded }: { today: string; onAdded: () => void }) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async () => {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    const res = await createJournalEntry({ day: today, kind: 'note', body })
    setBusy(false)
    if ('error' in res) {
      toast.error(t('je_err_fmt').replace('{msg}', res.error))
      return
    }
    setText('')
    toast.success(t('js_composer_done'))
    onAdded()
  }
  return (
    <div data-testid="js-composer" style={{ display: 'flex', gap: 8, marginTop: 4 }}>
      <input
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void send()
          }
        }}
        placeholder={t('js_composer')}
        disabled={busy}
        style={{ flex: 1, minHeight: 40 }}
      />
      <button type="button" className="btn sm" disabled={busy || !text.trim()} onClick={() => void send()} style={{ minHeight: 40, ...(text.trim() ? MAIN_ACTION_STYLE : {}) }}>
        {t('js_composer_send')}
      </button>
    </div>
  )
}

export function JournalDesk() {
  const { t } = useI18n()
  const [page, setPage] = useState<JournalStreamPage | null>(null)
  const [failed, setFailed] = useState(false)
  const [scale, setScale] = useState<Scale>(0)
  const [sel, setSel] = useState<JournalSelection | null>(null)
  const [jump, setJump] = useState<string | null>(null)
  const [dateInput, setDateInput] = useState('')
  const [refreshSignal, setRefreshSignal] = useState(0)

  useEffect(() => {
    let alive = true
    void fetch('/api/journal/stream?days=5', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((p: JournalStreamPage) => {
        if (alive) setPage(p)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
      .finally(() => foregroundSettled())
    return () => {
      alive = false
    }
  }, [])

  const onJump = useCallback((day: string) => {
    setJump(null)
    requestAnimationFrame(() => setJump(day))
  }, [])

  return (
    <div data-testid="journal-desk" style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, minWidth: 0, alignSelf: 'stretch', height: 'calc(100dvh - var(--atelier-top-h, 56px))', minHeight: 480, background: 'var(--bg0)' }}>
      <JournalStreamSwitchKeeper />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: '1px solid var(--bd)', background: 'var(--bg1)' }}>
        <h1 style={{ fontSize: 18, margin: 0, marginRight: 6 }}>{t('js_title')}</h1>
        <JournalScaleSwitch scale={scale} onChange={setScale} />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tx3)' }}>
          {t('js_go_to')}
          <input
            type="date"
            className="input"
            value={dateInput}
            max={page?.today}
            onChange={(e) => {
              setDateInput(e.target.value)
              if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) onJump(e.target.value)
            }}
            style={{ minHeight: 34, width: 150 }}
          />
        </label>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px' }}>
        <div data-testid="journal-desk-stream" style={{ overflow: 'auto', padding: '0 28px 40px', borderRight: '1px solid var(--bd)' }}>
          <div style={{ maxWidth: 780, margin: '0 auto' }}>
            {page ? (
              <JournalStream
                initial={page}
                narrow={false}
                scale={scale}
                onScaleChange={setScale}
                onSelect={setSel}
                selectedKey={sel?.key ?? null}
                jumpTo={jump}
                refreshSignal={refreshSignal}
                todayExtra={<Composer today={page.today} onAdded={() => setRefreshSignal((n) => n + 1)} />}
              />
            ) : failed ? (
              <p style={{ color: 'var(--tx3)', padding: 20 }}>{t('js_load_error')}</p>
            ) : (
              <p style={{ color: 'var(--tx3)', padding: 20 }}>{t('js_loading')}</p>
            )}
          </div>
        </div>
        <aside aria-label={t('js_rail_aria')} style={{ overflow: 'auto', padding: 14, background: 'var(--bg1)' }}>
          <Rail sel={sel} onJump={onJump} />
        </aside>
      </div>
    </div>
  )
}
