'use client'

// The desk face of the Journal stream (design docs/design/2026-11-22/JournalDesign.md §4 desk, mockup
// Journal_Mockup.html): toolbar (Jours / Mois / Années, « aller au »), the same stream and cards as the
// phone, wide, and on the right the rail — what the clicked card is connected to (its works and the other
// days that mention them, its ✦ suggestions, its ideas). Today ends with a composer. Shown in the Journal
// tab while the switch is on (`?stream=1`, a cookie; `?stream=0` goes back).
// Capture on the desk (design 2026-11-23 JournalDesk.md): paste or drop an image onto a day (admin, Jours),
// and 🎤 — the phone's recorder with the PC microphone, live words off unless this PC turned them on.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import dynamic from 'next/dynamic'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { thumbUrl } from '@/lib/data'
import { foregroundSettled } from '@/lib/atelier/foreground-gate'
import { createJournalEntry } from '@/app/atelier/(portal)/journal/entry-actions'
import { useLinkPicker } from '@/components/journal/LinkPicker'
import { JournalScaleSwitch, JournalStream, type JournalSelection } from '@/components/journal/JournalStream'
import { JournalStreamSwitchKeeper } from '@/components/journal/StreamSwitchKeeper'
import { MAIN_ACTION_STYLE } from '@/lib/ui/main-action'
import type { JournalStreamPage, JournalWorkMentions } from '@/lib/journal/stream'
import { useDeskImageCapture } from '@/components/journal/DeskImageCapture'
import { DayTray, TrayPane, usePcTray } from '@/components/journal/PcTray'

const VoiceNoteSheet = dynamic(() => import('@/components/shared/VoiceNoteSheet').then((m) => m.VoiceNoteSheet), { ssr: false })

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
  const picker = useLinkPicker(text, setText)
  const send = async () => {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    const res = await createJournalEntry({ day: today, kind: 'note', body, links: picker.links })
    setBusy(false)
    if ('error' in res) {
      toast.error(t('je_err_fmt').replace('{msg}', res.error))
      return
    }
    setText('')
    picker.clear()
    if (res.linkError) toast.error(t('lp_link_error').replace('{msg}', res.linkError))
    else toast.success(t('js_composer_done'))
    onAdded()
  }
  return (
    <div data-testid="js-composer" style={{ marginTop: 4, display: 'grid', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 8 }}>
      <input
        className="input"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          picker.onChange(e)
        }}
        onClick={picker.onChange}
        onKeyUp={picker.onCaret}
        onKeyDown={(e) => {
          if (picker.onKeyDown(e)) return
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
      {picker.popover}
      {picker.chips}
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
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [refreshDaySignal, setRefreshDaySignal] = useState<{ day: string } | null>(null)
  const [editPhotoId, setEditPhotoId] = useState<string | null>(null)
  const streamRef = useRef<HTMLDivElement>(null)
  const [trayOpen, setTrayOpen] = useState(false)
  const tray = usePcTray(!!page?.isAdmin)
  // A photo landed (paste, drop or the tray): read its day again; a single new one opens its text box, once.
  const onPhotoSaved = useCallback((day: string, id: string, isNew: boolean) => {
    setEditPhotoId(isNew && id ? id : null)
    setRefreshDaySignal({ day })
    if (isNew && id) window.setTimeout(() => setEditPhotoId((cur) => (cur === id ? null : cur)), 15_000)
  }, [])
  const dayTop = useCallback((day: string) => <DayTray tray={tray} day={day} onSaved={onPhotoSaved} />, [tray, onPhotoSaved])
  const capture = useDeskImageCapture({
    // Not while the recorder is open (a paste there is not meant for the stream).
    enabled: !!page?.isAdmin && scale === 0 && !voiceOpen,
    scrollRef: streamRef,
    onSaved: useCallback((day: string, id: string, isNew: boolean) => {
      onPhotoSaved(day, id, isNew)
      if (!isNew) {
        setJump(null)
        requestAnimationFrame(() => setJump(day))
      }
    }, [onPhotoSaved]),
  })

  useEffect(() => {
    let alive = true
    void fetch('/api/journal/stream?days=5', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((p: JournalStreamPage) => {
        if (!alive) return
        setPage(p)
        // A link to one day (⌘K, Chronologie, Notes, see-again: `/atelier/journal?day=…`) opens the stream there.
        const d = new URLSearchParams(window.location.search).get('day')
        if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setJump(d)
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
        {page?.isAdmin && scale === 0 ? <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('jd_hint')}</span> : null}
        {page?.isAdmin && tray.status !== 'unsupported' ? (
          <button
            type="button"
            className="btn ghost sm"
            data-testid="jt-open"
            aria-pressed={trayOpen}
            title={t('jt_button_aria')}
            onClick={() => setTrayOpen((v) => !v)}
            style={{ marginLeft: 'auto', minHeight: 36, borderRadius: 999, border: '1px solid var(--ac)', color: 'var(--ac)' }}
          >
            {t('jt_button').replace('{n}', tray.status === 'ready' ? String(tray.count) : '…')}
          </button>
        ) : null}
        <button
          type="button"
          className="btn sm"
          data-testid="journal-desk-mic"
          aria-label={t('jd_mic_aria')}
          title={t('jd_mic_aria')}
          onClick={() => { setImportFile(null); setVoiceOpen(true) }}
          style={{ ...MAIN_ACTION_STYLE, marginLeft: page?.isAdmin && tray.status !== 'unsupported' ? 0 : 'auto', minHeight: 36, borderRadius: 999, padding: '0 14px' }}
        >
          🎤 {t('jd_mic')}
        </button>
        {/* « Importer un enregistrement » (Voice Memos, RecorderPause.md): filed on the day it was recorded. */}
        <label className="btn ghost sm" data-testid="journal-desk-import-audio" title={t('vc_import_sub')} style={{ minHeight: 36, borderRadius: 999, padding: '0 12px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
          🎧 {t('vc_import')}
          <input type="file" accept="audio/*,.m4a" hidden onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) { setImportFile(f); setVoiceOpen(true) }
          }} />
        </label>
      </div>
      {voiceOpen ? (
        <VoiceNoteSheet
          open={voiceOpen}
          importFile={importFile}
          liveWordsOffByDefault
          onClose={() => {
            setImportFile(null)
            setVoiceOpen(false)
            setRefreshSignal((n) => n + 1)
          }}
          onSaved={(info) => {
            setRefreshSignal((n) => n + 1)
            // An imported memo lands on its own (older) day: re-read that day too.
            if (info?.day) setRefreshDaySignal({ day: info.day })
          }}
        />
      ) : null}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px' }}>
        <div ref={streamRef} data-testid="journal-desk-stream" {...capture.handlers} style={{ overflow: 'auto', padding: '0 28px 40px', borderRight: '1px solid var(--bd)', position: 'relative' }}>
          {capture.dropDay ? (
            <style>{`#js-day-${capture.dropDay}{outline:2px dashed var(--ac);outline-offset:-2px;border-radius:10px;background:color-mix(in srgb,var(--ac) 8%,transparent)}`}</style>
          ) : null}
          {capture.dropLabel ? (
            <div data-testid="journal-desk-drop-label" style={{ position: 'sticky', top: 52, zIndex: 5, height: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
              <span style={{ background: 'var(--ac)', color: 'var(--onac, #14110a)', fontWeight: 600, padding: '6px 14px', borderRadius: 999, whiteSpace: 'nowrap', height: 'fit-content' }}>{capture.dropLabel}</span>
            </div>
          ) : null}
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
                refreshDaySignal={refreshDaySignal}
                editPhotoId={editPhotoId}
                dayTop={page.isAdmin && tray.status === 'ready' ? dayTop : undefined}
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
          {trayOpen ? <TrayPane tray={tray} onClose={() => setTrayOpen(false)} onJump={onJump} /> : <Rail sel={sel} onJump={onJump} />}
        </aside>
      </div>
    </div>
  )
}
