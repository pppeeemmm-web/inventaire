'use client'

// « Sur ce PC » — the iPhone's photos synced to this PC (Syncthing / Synctrain), readied by the PC agent
// (scripts/ai-agent/tray.mjs) in the folder PEM-Tray: previews, 2100 px copies, tray.json. Design
// docs/design/2026-11-23/JournalDesk.md §6. The page reads that folder through Chrome's folder access (linked
// once, kept by Chrome); nothing leaves the PC until Pem ticks photos and clicks « Mettre sur ce jour », which
// sends each copy through the same door as a paste (`putImageOnDay`, one-time id = the agent's id from the
// original file's bytes). What was sent or set aside is remembered here (IndexedDB, this PC only).

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { MAIN_ACTION_STYLE } from '@/lib/ui/main-action'
import { doorErrorText, putImageOnDay } from '@/components/journal/DeskImageCapture'

/* ── what the agent writes (tray.json) ── */
/** The photo's own data as tray.mjs reads it (EXIF of the original file; `taken` = the phone's clock, Paris). */
export type TrayMeta = { taken?: string | null; camera?: string | null; lens?: string | null; fnumber?: string | null; exposure?: string | null; iso?: string | null; gps?: { lat: number; lon: number } | null }
export type TrayItem = { id: string; rel: string; name: string; day: string; dayFrom: 'folder' | 'taken' | 'file'; preview: string; send: string; meta?: TrayMeta | null; w?: number | null; h?: number | null }

/** tray.json's meta → the door's `meta` field (journal_step_b2.sql: the place goes to its admin-only row). */
export function trayMetaForDoor(it: TrayItem): Record<string, unknown> | null {
  const m = it.meta ?? {}
  const num = (v: string | null | undefined) => {
    if (!v) return undefined
    const f = /^(\d+)\/(\d+)$/.exec(v.trim())
    const n = f ? Number(f[1]) / Number(f[2]) : Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  // « 2026:06:03 11:17:11 » is Paris wall time: kept as an ISO string without zone (shown as written).
  const t = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(m.taken ?? '')
  const out: Record<string, unknown> = {
    taken_at: t ? `${t[1]}-${t[2]}-${t[3]}T${t[4]}:${t[5]}:${t[6]}` : undefined,
    model: m.camera || undefined,
    lens: m.lens || undefined,
    f_number: num(m.fnumber),
    exposure: num(m.exposure),
    iso: num(m.iso),
    width: it.w ?? undefined,
    height: it.h ?? undefined,
    file_name: it.name,
    gps: m.gps ?? undefined,
  }
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k]
  return Object.keys(out).length ? out : null
}
type TrayFile = { v: number; from: string; updatedAt: string; items: TrayItem[]; failed?: { rel: string; reason: string }[] }

/* ── Chrome's folder access (not in TypeScript's DOM types yet) ── */
type PermState = 'granted' | 'denied' | 'prompt'
type DirHandle = {
  name: string
  getFileHandle(name: string): Promise<{ getFile(): Promise<File> }>
  getDirectoryHandle(name: string): Promise<DirHandle>
  queryPermission(o: { mode: 'read' }): Promise<PermState>
  requestPermission(o: { mode: 'read' }): Promise<PermState>
}
type PickerWindow = Window & { showDirectoryPicker?: (o?: { id?: string; mode?: 'read'; startIn?: 'desktop' }) => Promise<DirHandle> }

/* ── this PC's memory: the linked folder, what was sent, what was set aside ── */
const DB = 'pem-pc-tray-v1'
function kv<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1)
    open.onupgradeneeded = () => open.result.createObjectStore('kv')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const req = fn(db.transaction('kv', mode).objectStore('kv'))
      req.onsuccess = () => {
        resolve(req.result as T)
        db.close()
      }
      req.onerror = () => {
        reject(req.error)
        db.close()
      }
    }
  })
}
const kvGet = <T,>(k: string) => kv<T | undefined>('readonly', (s) => s.get(k))
const kvSet = (k: string, v: unknown) => kv<unknown>('readwrite', (s) => s.put(v, k))

async function readPath(dir: DirHandle, rel: string): Promise<File> {
  const parts = rel.split('/')
  let d = dir
  for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p)
  return (await d.getFileHandle(parts[parts.length - 1])).getFile()
}

/** On the PC: open the pem-ai: link (one agent pass, which ends with the tray step). Same as Bureau IA. */
function startAgentHere() {
  const f = document.createElement('iframe')
  f.style.display = 'none'
  f.src = 'pem-ai:run'
  document.body.appendChild(f)
  window.setTimeout(() => f.remove(), 3000)
}

export type PcTray = ReturnType<typeof usePcTray>

export function usePcTray(enabled: boolean) {
  const { t } = useI18n()
  const [status, setStatus] = useState<'off' | 'unsupported' | 'none' | 'permission' | 'wrong' | 'sync' | 'ready'>('off')
  const [dir, setDir] = useState<DirHandle | null>(null)
  const [file, setFile] = useState<TrayFile | null>(null)
  const [sent, setSent] = useState<Set<string>>(() => new Set())
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [showOld, setShowOld] = useState(false)

  const read = useCallback(async (d: DirHandle) => {
    try {
      const f = JSON.parse(await (await d.getFileHandle('tray.json')).getFile().then((x) => x.text())) as TrayFile
      // Same list as before (the 10 s re-read): nothing to redraw.
      setFile((cur) => (cur && cur.updatedAt === f.updatedAt ? cur : f))
      setStatus('ready')
      // eslint-disable-next-line pem-i18n/no-silent-catch -- shown: « not PEM-Tray » with what to do
    } catch {
      setStatus('wrong')
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined' || !(window as PickerWindow).showDirectoryPicker) return void setStatus('unsupported')
    let alive = true
    void (async () => {
      try {
        const [d, s, x] = await Promise.all([kvGet<DirHandle>('dir'), kvGet<string[]>('sent'), kvGet<string[]>('dismissed')])
        if (!alive) return
        setSent(new Set(s ?? []))
        setDismissed(new Set(x ?? []))
        if (!d) return void setStatus('none')
        setDir(d)
        if ((await d.queryPermission({ mode: 'read' })) !== 'granted') return void setStatus('permission')
        await read(d)
        // eslint-disable-next-line pem-i18n/no-silent-catch -- no IndexedDB (private window): the tray asks to link again
      } catch {
        if (alive) setStatus('none')
      }
    })()
    return () => {
      alive = false
    }
  }, [enabled, read])

  /** « Relier le dossier »: Chrome's folder picker (a click). */
  const link = useCallback(async () => {
    const w = window as PickerWindow
    if (!w.showDirectoryPicker) return
    let d: DirHandle
    try {
      // Called on `window` (a detached call is refused by Chrome); opens on the Desktop, where PEM-Tray sits.
      d = await w.showDirectoryPicker({ id: 'pem-tray-desktop', mode: 'read', startIn: 'desktop' })
      // eslint-disable-next-line pem-i18n/no-silent-catch -- shown as a toast (Annuler excepted)
    } catch (e) {
      // Closed with « Annuler »: nothing changes. Anything else is said (it was silent before — Pem 2026-11-23).
      if ((e as Error)?.name !== 'AbortError') toast.error(t('je_err_fmt').replace('{msg}', `${(e as Error)?.name ?? ''} ${(e as Error)?.message ?? String(e)}`))
      return
    }
    // The phone's own folder (« Sync all », Syncthing's `.stfolder` inside) is picked by mistake (Pem 2026-11-23):
    // say which folder is the right one, and keep nothing.
    const isSync = await d.getDirectoryHandle('.stfolder').then(
      () => true,
      () => false,
    )
    if (isSync) return void setStatus('sync')
    setDir(d)
    await read(d)
    try {
      await kvSet('dir', d)
      // eslint-disable-next-line pem-i18n/no-silent-catch -- shown as a toast
    } catch (e) {
      // Linked for this visit; it will ask again next time.
      toast.error(t('je_err_fmt').replace('{msg}', `IndexedDB ${(e as Error)?.message ?? String(e)}`))
    }
  }, [read, t])

  /** « Autoriser »: Chrome asks again after a restart unless « à chaque visite » was chosen (a click). */
  const allow = useCallback(async () => {
    if (!dir) return
    if ((await dir.requestPermission({ mode: 'read' })) === 'granted') await read(dir)
  }, [dir, read])

  // Also when the folder was linked before the agent's first pass (« not PEM-Tray » until tray.json appears).
  const reload = useCallback(async () => {
    if (dir && (status === 'ready' || status === 'wrong')) await read(dir)
  }, [dir, status, read])

  // Latest sets, so two days sending at once never lose each other's ids.
  const sets = useRef({ sent, dismissed })
  sets.current = { sent, dismissed }
  const remember = useCallback(async (key: 'sent' | 'dismissed', change: (cur: Set<string>) => Set<string>) => {
    const next = change(sets.current[key])
    sets.current = { ...sets.current, [key]: next }
    ;(key === 'sent' ? setSent : setDismissed)(next)
    try {
      await kvSet(key, [...next])
      // eslint-disable-next-line pem-i18n/no-silent-catch -- this PC's memory only; the door refuses a double anyway
    } catch {
      /* private window */
    }
  }, [])

  const open = useMemo(() => (file?.items ?? []).filter((it) => !sent.has(it.id) && !dismissed.has(it.id)), [file, sent, dismissed])
  const shown = useMemo(() => open.filter((it) => showOld || it.day >= (file?.from ?? '')), [open, showOld, file])
  const byDay = useMemo(() => {
    const m = new Map<string, TrayItem[]>()
    for (const it of shown) m.set(it.day, [...(m.get(it.day) ?? []), it])
    return m
  }, [shown])

  // One object per change of what it shows (the stream redraws its days when this changes, not on every render).
  return useMemo(
    () => ({
      status,
      file,
      byDay,
      count: shown.length,
      olderCount: open.length - open.filter((it) => it.day >= (file?.from ?? '')).length,
      dismissedItems: (file?.items ?? []).filter((it) => dismissed.has(it.id)),
      showOld,
      setShowOld,
      link,
      allow,
      reload,
      readFile: (rel: string) => (dir ? readPath(dir, rel) : Promise.reject(new Error('no folder'))),
      markSent: (ids: string[]) => remember('sent', (cur) => new Set([...cur, ...ids])),
      dismiss: (ids: string[]) => remember('dismissed', (cur) => new Set([...cur, ...ids])),
      restore: (ids: string[]) => remember('dismissed', (cur) => new Set([...cur].filter((x) => !ids.includes(x)))),
    }),
    [status, file, byDay, shown, open, dismissed, showOld, link, allow, reload, dir, remember],
  )
}

/* ── pictures read from the folder (object URLs, freed when they leave) ── */
function TrayPic({ tray, rel, size, style }: { tray: PcTray; rel: string; size: [number, number]; style?: CSSProperties }) {
  const [src, setSrc] = useState<string | null>(null)
  const readFile = tray.readFile
  useEffect(() => {
    let url: string | null = null
    let alive = true
    void readFile(rel)
      .then((f) => {
        url = URL.createObjectURL(f)
        if (alive) setSrc(url)
        else URL.revokeObjectURL(url)
      })
      // eslint-disable-next-line pem-i18n/no-silent-catch -- a preview gone (next agent pass removes it): grey square
      .catch(() => undefined)
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rel])
  const box: CSSProperties = { width: size[0], height: size[1], borderRadius: 8, objectFit: 'cover', background: 'var(--bg3)', display: 'block', ...style }
  // eslint-disable-next-line @next/next/no-img-element -- a local file (object URL), not an R2 image
  return src ? <img src={src} alt="" style={box} /> : <span aria-hidden="true" style={box} />
}

/** Under a day's divider: « 📁 3 sur ce PC », and the strip to tick and send. */
export function DayTray({ tray, day, onSaved }: { tray: PcTray; day: string; onSaved: (day: string, id: string, isNew: boolean) => void }) {
  const { t, lang } = useI18n()
  const items = tray.byDay.get(day) ?? []
  const [openStrip, setOpenStrip] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState(false)
  if (!items.length) return null
  const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
  const label = dayLabel(day)
  const toggle = (id: string) =>
    setPicked((cur) => {
      const n = new Set(cur)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const chosen = items.filter((it) => picked.has(it.id))

  const put = async () => {
    if (!chosen.length || busy) return
    setBusy(true)
    let ok = 0
    let already = 0
    let alreadyDay: string | null = null
    let queued = 0
    const done: string[] = []
    let lastNew: string | null = null
    for (const it of chosen) {
      try {
        const blob = await tray.readFile(it.send)
        const res = await putImageOnDay(blob, it.name.replace(/\.[^.]+$/, '.jpg'), day, it.id, trayMetaForDoor(it))
        if ('error' in res) {
          toast.error(`${it.name} — ${doorErrorText(res.error, t)}`)
          continue
        }
        done.push(it.id)
        if ('queued' in res) queued++
        else if (res.already) {
          already++
          alreadyDay = res.day
        }
        else {
          ok++
          lastNew = res.id
        }
        // eslint-disable-next-line pem-i18n/no-silent-catch -- shown as a toast with the file name
      } catch (e) {
        toast.error(`${it.name} — ${t('je_err_fmt').replace('{msg}', e instanceof Error ? e.message : String(e))}`)
      }
    }
    await tray.markSent(done)
    setPicked(new Set())
    setBusy(false)
    const parts = [ok ? t('jt_put_done').replace('{n}', String(ok)).replace('{day}', label) : '', already ? t('jt_put_already').replace('{n}', String(already)).replace('{day}', alreadyDay ? dayLabel(alreadyDay) : label) : '', queued ? t('jt_put_queued').replace('{n}', String(queued)) : ''].filter(Boolean)
    if (parts.length) toast.success(parts.join(' · '))
    if (ok) onSaved(day, ok === 1 && lastNew ? lastNew : '', ok === 1)
    // A photo already in the Journal is shown on the day it is really on, not the one clicked.
    else if (alreadyDay) onSaved(alreadyDay, '', false)
  }

  const skip = async () => {
    if (!chosen.length) return void toast.info(t('jt_skip_first'))
    await tray.dismiss(chosen.map((it) => it.id))
    setPicked(new Set())
    toast.info(t('jt_skipped'))
  }

  return (
    <div data-testid={`jt-day-${day}`} style={{ margin: '8px 0 0' }}>
      <button
        type="button"
        aria-expanded={openStrip}
        onClick={() => setOpenStrip((v) => !v)}
        data-testid={`jt-chip-${day}`}
        style={{ border: '1px dashed var(--bd2)', borderRadius: 999, padding: '2px 12px', fontSize: 12, color: openStrip ? 'var(--ac)' : 'var(--tx2)', background: 'none', cursor: 'pointer', minHeight: 30 }}
      >
        {t('jt_day_chip').replace('{n}', String(items.length))}
      </button>
      {openStrip ? (
        <div style={{ border: '1px dashed var(--bd2)', borderRadius: 10, padding: 10, marginTop: 8, background: 'var(--bg0)' }}>
          <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 8 }}>{t('jt_day_head').replace('{folder}', items[0].rel.includes('/') ? items[0].rel.split('/')[0] : 'Sync all')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {items.map((it) => {
              const on = picked.has(it.id)
              return (
                <button
                  key={it.id}
                  type="button"
                  aria-pressed={on}
                  title={it.name}
                  onClick={() => toggle(it.id)}
                  data-testid={`jt-tile-${it.id}`}
                  style={{ position: 'relative', padding: 0, border: `2px solid ${on ? 'var(--ac)' : 'transparent'}`, borderRadius: 10, background: 'none', cursor: 'pointer' }}
                >
                  <TrayPic tray={tray} rel={it.preview} size={[120, 90]} />
                  <span aria-hidden="true" style={{ position: 'absolute', top: 5, left: 5, width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13, background: on ? 'var(--ac)' : 'rgba(0,0,0,.55)', color: on ? 'var(--onac, #14110a)' : '#fff', border: '1px solid #fff8' }}>
                    ✓
                  </span>
                  {it.dayFrom !== 'folder' ? (
                    <span style={{ position: 'absolute', right: 5, bottom: 4, fontSize: 10, color: '#fff', background: 'rgba(0,0,0,.55)', padding: '0 4px', borderRadius: 3 }}>{t(it.dayFrom === 'taken' ? 'jt_by_taken' : 'jt_by_file')}</span>
                  ) : null}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
            <button type="button" className="btn sm" disabled={!chosen.length || busy} onClick={() => void put()} data-testid={`jt-put-${day}`} style={{ minHeight: 36, ...(chosen.length ? MAIN_ACTION_STYLE : {}) }}>
              {t('jt_put').replace('{n}', String(chosen.length))}
            </button>
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => void skip()} style={{ minHeight: 36 }}>
              {t('jt_skip')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** The side pane (in place of the rail): link / allow the folder, prepare, the days, what was set aside, older. */
export function TrayPane({ tray, onClose, onJump }: { tray: PcTray; onClose: () => void; onJump: (day: string) => void }) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const reload = tray.reload
  const poll = useRef<number | null>(null)
  // While the pane is open, read tray.json again every 10 s (a local file): a pass started here shows up by itself.
  useEffect(() => {
    poll.current = window.setInterval(() => void reload(), 10_000)
    return () => {
      if (poll.current) window.clearInterval(poll.current)
    }
  }, [reload])
  const head: CSSProperties = { fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--tx3)', margin: '16px 0 6px' }
  const muted: CSSProperties = { color: 'var(--tx3)', fontSize: 13, margin: '6px 0' }
  return (
    <div data-testid="jt-pane">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 style={{ ...head, margin: 0 }}>{t('jt_title')}</h3>
        <button type="button" className="btn ghost sm" onClick={onClose} style={{ marginLeft: 'auto', minHeight: 32 }}>
          {t('jt_close')}
        </button>
      </div>
      <p style={muted}>{t('jt_intro')}</p>
      {tray.status === 'unsupported' ? <p style={muted}>{t('jt_unsupported')}</p> : null}
      {tray.status === 'none' || tray.status === 'wrong' || tray.status === 'sync' ? (
        <>
          {tray.status === 'wrong' ? <p style={{ ...muted, color: 'var(--rust, #d9734a)' }}>{t('jt_wrong_folder')}</p> : null}
          {tray.status === 'sync' ? <p style={{ ...muted, color: 'var(--rust, #d9734a)' }}>{t('jt_sync_folder')}</p> : null}
          <button type="button" className="btn sm" onClick={() => void tray.link()} style={{ ...MAIN_ACTION_STYLE, minHeight: 36 }} data-testid="jt-link">
            {t('jt_link')}
          </button>
          <p style={muted}>{t('jt_link_help')}</p>
        </>
      ) : null}
      {tray.status === 'permission' ? (
        <button type="button" className="btn sm" onClick={() => void tray.allow()} style={{ ...MAIN_ACTION_STYLE, minHeight: 36 }} data-testid="jt-allow">
          {t('jt_allow')}
        </button>
      ) : null}
      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => {
            startAgentHere()
            toast.info(t('jt_prepare_started'))
          }}
          style={{ minHeight: 36 }}
        >
          {t('jt_prepare')}
        </button>
        <p style={muted}>{t('jt_prepare_help')}</p>
      </div>
      {tray.status === 'ready' && tray.file ? (
        <>
          <p style={muted}>
            {t('jt_last').replace('{when}', new Date(tray.file.updatedAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }))} · {t('jt_from').replace('{day}', day(tray.file.from))}
            {tray.file.failed?.length ? ` · ${t('jt_failed').replace('{n}', String(tray.file.failed.length))}` : ''}
          </p>
          {tray.count ? (
            [...tray.byDay.entries()].map(([d, items]) => (
              <button key={d} type="button" onClick={() => onJump(d)} style={{ display: 'flex', width: '100%', gap: 8, alignItems: 'center', padding: '8px 0', border: 0, borderBottom: '1px solid var(--bd)', background: 'none', color: 'var(--tx)', cursor: 'pointer', textAlign: 'left', font: 'inherit', fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{day(d)}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--tx3)' }}>{items.length}</span>
              </button>
            ))
          ) : (
            <p style={muted}>{t('jt_none')}</p>
          )}
          {tray.olderCount || tray.showOld ? (
            <button type="button" className="btn ghost sm" onClick={() => tray.setShowOld(!tray.showOld)} style={{ minHeight: 32, marginTop: 10 }} data-testid="jt-older">
              {tray.showOld ? t('jt_older_hide') : `${t('jt_older')} (${tray.olderCount})`}
            </button>
          ) : null}
          {tray.dismissedItems.length ? (
            <>
              <h3 style={head}>{t('jt_dismissed')}</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {tray.dismissedItems.map((it) => (
                  <span key={it.id} style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                    <TrayPic tray={tray} rel={it.preview} size={[72, 54]} style={{ opacity: 0.7 }} />
                    <button type="button" className="btn ghost sm" onClick={() => void tray.restore([it.id])} style={{ minHeight: 28, fontSize: 11, padding: '0 6px' }}>
                      {t('jt_restore')}
                    </button>
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
