'use client'

// Year pass on the phone (week-1 report §3.1): one work at a time — its image, what it is, the years already known in
// its themes — then a year, « Je ne sais pas », or « ← Précédente » to correct the last one. Writes through
// setWorkYear (admin only, stale-checked). The page brings 20 at a time; at the end of a page it reads the next one.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl } from '@/lib/data'
import { setWorkYear } from '@/app/atelier/works/year-actions'

export type YearPassWork = {
  id: number
  title: string | null
  image: string | null
  technique: string
  support: string
  size: string
  inSelection: boolean
  themes: Array<{ name: string; min: number; max: number; n: number }>
}

type Done = { id: number; year: number }

export function YearPassClient({ works, remaining, skipped, adminOnly = false }: { works: YearPassWork[]; remaining: number; skipped: number[]; adminOnly?: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const [i, setI] = useState(0)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [done, setDone] = useState<Done[]>([])
  const [skips, setSkips] = useState<number[]>(skipped)
  /** Correcting the last saved work: its id and the year it now has (the stale check expects it). */
  const [fix, setFix] = useState<Done | null>(null)
  const now = new Date().getFullYear()

  const work = fix ? works.find((w) => w.id === fix.id) ?? null : works[i] ?? null
  const hints = useMemo(() => {
    const ys = new Set<number>()
    for (const th of work?.themes ?? []) if (th.n) { ys.add(th.min); ys.add(th.max) }
    for (const d of done.slice(-3)) ys.add(d.year)
    return [...ys].filter((y) => y >= 1950 && y <= now).sort((a, b) => b - a).slice(0, 6)
  }, [work, done, now])

  const nextPage = (extraSkip: number[]) => {
    const all = [...skips, ...extraSkip]
    router.replace(all.length ? `/atelier/year-pass?skip=${all.join(',')}` : '/atelier/year-pass')
    router.refresh()
  }
  const advance = (extraSkip: number[] = []) => {
    setText('')
    setMsg(null)
    if (i + 1 >= works.length) { nextPage(extraSkip); return }
    setI(i + 1)
  }

  const save = async (year: number) => {
    if (!work || busy) return
    if (!Number.isInteger(year) || year < 1950 || year > now) { setMsg(t('yp_err_year').replace('{max}', String(now))); return }
    setBusy(true)
    const r = await setWorkYear(work.id, year, fix ? fix.year : null)
    setBusy(false)
    if ('error' in r) { setMsg(t(`yp_err_${r.error}` as never)); return }
    if (fix) {
      setDone((d) => d.map((x) => (x.id === fix.id ? { id: fix.id, year } : x)))
      setFix(null)
      setText('')
      setMsg(t('yp_fixed').replace('{n}', String(work.id)).replace('{y}', String(year)))
      return
    }
    setDone((d) => [...d, { id: work.id, year }])
    advance()
  }
  const skip = () => {
    if (!work) return
    setSkips((s) => [...s, work.id])
    advance([work.id])
  }
  const back = () => {
    const last = done.at(-1)
    if (!last) return
    setFix(last)
    setText(String(last.year))
    setMsg(null)
  }

  if (adminOnly) return <main style={wrap}><p>{t('yp_admin_only')}</p></main>

  const left = Math.max(0, remaining - done.length)
  return (
    <main style={wrap} data-testid="year-pass">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <a href="/hub" className="btn ghost sm" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>←</a>
        <h1 style={{ fontSize: 18, margin: 0, flex: 1 }}>{t('yp_title')}</h1>
        <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('yp_left_fmt').replace('{n}', String(left))}</span>
      </div>
      {done.length ? <p className="t-mono-sm" style={{ color: 'var(--sage)', margin: '4px 0 0' }}>{t('yp_done_fmt').replace('{n}', String(done.length))}</p> : null}

      {!work ? (
        <p style={{ color: 'var(--tx3)', marginTop: 24 }}>{t('yp_empty')}</p>
      ) : (
        <section style={{ marginTop: 12 }}>
          {work.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- the work's R2 image, through imageUrl()
            <img src={imageUrl(work.image) ?? ''} alt="" style={{ display: 'block', width: '100%', maxHeight: '42dvh', objectFit: 'contain', background: 'var(--bg1)', borderRadius: 8 }} />
          ) : <div style={{ height: 160, border: '1px dashed var(--bd)', borderRadius: 8 }} />}
          <div style={{ marginTop: 8 }}>
            <a href={`/atelier/inventory?work=${work.id}`} style={{ fontSize: 16, color: 'var(--tx)' }}>#{work.id} {work.title ?? t('yp_untitled')}</a>
            {work.inSelection ? <span className="t-mono-sm" style={{ marginLeft: 8, color: 'var(--ac)' }}>{t('yp_in_selection')}</span> : null}
            <div className="t-mono-sm" style={{ color: 'var(--tx2)', marginTop: 2 }}>{[work.technique, work.support, work.size].filter(Boolean).join(' · ')}</div>
            {work.themes.map((th) => (
              <div key={th.name} className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
                {th.name}{th.n ? ` — ${th.min === th.max ? th.min : `${th.min}–${th.max}`} (${t('yp_dated_fmt').replace('{n}', String(th.n))})` : ''}
              </div>
            ))}
          </div>

          {fix ? <p className="t-mono-sm" style={{ color: 'var(--rust)', margin: '10px 0 0' }}>{t('yp_fixing_fmt').replace('{y}', String(fix.year))}</p> : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {hints.map((y) => (
              <button key={y} type="button" className="btn sm" disabled={busy} onClick={() => void save(y)} style={{ minHeight: 44, minWidth: 64 }}>{y}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              placeholder={t('yp_year_ph')}
              aria-label={t('yp_year_ph')}
              data-testid="year-pass-input"
              style={{ flex: 1, minWidth: 0, minHeight: 48, fontSize: 20, padding: '0 12px', border: '1px solid var(--bd)', borderRadius: 8, background: 'var(--bg0)', color: 'var(--tx)' }}
            />
            <button type="button" className="btn primary" disabled={busy || text.length !== 4} onClick={() => void save(Number(text))} data-testid="year-pass-save" style={{ minHeight: 48, minWidth: 110 }}>
              {busy ? '…' : t('yp_save')}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" className="btn ghost" disabled={busy || !done.length || !!fix} onClick={back} style={{ flex: 1, minHeight: 44 }}>{t('yp_back')}</button>
            {fix ? (
              <button type="button" className="btn ghost" disabled={busy} onClick={() => { setFix(null); setText(''); setMsg(null) }} style={{ flex: 1, minHeight: 44 }}>{t('yp_fix_cancel')}</button>
            ) : (
              <button type="button" className="btn ghost" disabled={busy} onClick={skip} data-testid="year-pass-skip" style={{ flex: 1, minHeight: 44 }}>{t('yp_skip')}</button>
            )}
          </div>
          {msg ? <p role="status" className="t-mono-sm" style={{ marginTop: 10, color: 'var(--tx2)' }}>{msg}</p> : null}
        </section>
      )}
    </main>
  )
}

const wrap = { maxWidth: 560, margin: '0 auto', padding: 'max(12px, env(safe-area-inset-top, 0px)) 16px max(96px, env(safe-area-inset-bottom, 0px))', color: 'var(--tx)' } as const
