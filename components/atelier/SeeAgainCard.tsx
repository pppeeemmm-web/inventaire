'use client'

// "See again" (owner GO 2026-11-13): up to three things to look at again today — an old entry,
// a work with no link, a close pair of works. It only chooses; it writes no text. Same picks
// all day. Shown at the top of the Journal today page and in Overview.

import Link from 'next/link'
import { useCallback, useEffect, useState, useTransition, type CSSProperties } from 'react'
import { dismissSeeAgain, getSeeAgain, linkSeeAgainPair, type SeeAgainSlots, type SeeAgainWork } from '@/app/atelier/see-again/actions'
import { thumbUrl } from '@/lib/data'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'

/** Journal page listens for this to open its entry form with the text prefilled. */
export const JOURNAL_COMPOSE_EVENT = 'pem:journal-compose'

const workHref = (id: number) => `/atelier/inventory?work=${id}`
const btn: CSSProperties = { minHeight: 44, fontSize: 11, letterSpacing: 0.5 }

export function SeeAgainCard({ context }: { context: 'journal' | 'overview' }) {
  const { t, lang } = useI18n()
  const [slots, setSlots] = useState<SeeAgainSlots | null>(null)
  const [pending, startTransition] = useTransition()

  const load = useCallback(async () => {
    const res = await getSeeAgain()
    if ('error' in res) return
    setSlots(res)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  function write(text: string) {
    if (context === 'journal') {
      window.dispatchEvent(new CustomEvent(JOURNAL_COMPOSE_EVENT, { detail: text }))
    } else {
      window.location.assign(`/atelier/journal?today=1&write=${encodeURIComponent(text)}`)
    }
  }

  function run(fn: () => Promise<{ ok: true } | { error: string }>, done?: string) {
    startTransition(async () => {
      const res = await fn()
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      if (done) toast.success(done)
      await load()
    })
  }

  if (!slots || (!slots.then && !slots.alone && !slots.close)) return null
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <section
      data-testid="see-again-card"
      style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div className="t-eyebrow" style={{ color: 'var(--tx3)' }}>{t('sa_title')}</div>

      {slots.then ? (
        <Slot label={t(slots.then.sameWeek ? 'sa_then_week' : 'sa_then_older')}>
          <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)' }}>{dayLabel(slots.then.day)}</div>
          <p style={{ margin: '2px 0 6px', fontSize: 13, lineHeight: 1.45, color: 'var(--tx)', overflowWrap: 'anywhere' }}>
            {slots.then.snippet}
            {slots.then.snippet.length >= 220 ? '…' : ''}
          </p>
          <Actions>
            <Link href={`/atelier/journal?day=${slots.then.day}`} className="btn ghost sm" style={{ ...btn, display: 'inline-flex', alignItems: 'center' }}>
              {t('sa_open_day')}
            </Link>
            <button type="button" className="btn ghost sm" style={btn} disabled={pending} onClick={() => run(() => dismissSeeAgain('then', slots.then!.id))}>
              {t('sa_hide')}
            </button>
          </Actions>
        </Slot>
      ) : null}

      {slots.alone ? (
        <Slot label={t('sa_alone')}>
          <WorkLine w={slots.alone} untitled={t('sa_untitled')} />
          <Actions>
            <Link href={workHref(slots.alone.id)} className="btn ghost sm" style={{ ...btn, display: 'inline-flex', alignItems: 'center' }}>
              {t('sa_open_work')}
            </Link>
            <button type="button" className="btn ghost sm" style={btn} onClick={() => write(`#${slots.alone!.id} `)}>
              {t('sa_write')}
            </button>
            <button type="button" className="btn ghost sm" style={btn} disabled={pending} onClick={() => run(() => dismissSeeAgain('alone', slots.alone!.id))}>
              {t('sa_hide')}
            </button>
          </Actions>
        </Slot>
      ) : null}

      {slots.close ? (
        <Slot label={t('sa_close')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <WorkLine w={slots.close.a} untitled={t('sa_untitled')} />
            <WorkLine w={slots.close.b} untitled={t('sa_untitled')} />
          </div>
          <Actions>
            <button
              type="button"
              className="btn primary sm"
              style={btn}
              disabled={pending}
              onClick={() => run(() => linkSeeAgainPair(slots.close!.a.id, slots.close!.b.id), t('sa_linked'))}
            >
              {t('sa_link')}
            </button>
            <button
              type="button"
              className="btn ghost sm"
              style={btn}
              disabled={pending}
              onClick={() => run(() => dismissSeeAgain('close', slots.close!.a.id, slots.close!.b.id))}
            >
              {t('sa_not_related')}
            </button>
            <button type="button" className="btn ghost sm" style={btn} onClick={() => write(`#${slots.close!.a.id} #${slots.close!.b.id} `)}>
              {t('sa_write')}
            </button>
          </Actions>
        </Slot>
      ) : null}
    </section>
  )
}

function Slot({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderLeft: '2px solid var(--ac)', paddingLeft: 10 }}>
      <div className="t-mono-sm" style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--ac)', marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>{children}</div>
}

function WorkLine({ w, untitled }: { w: SeeAgainWork; untitled: string }) {
  const src = thumbUrl(w.image)
  return (
    <Link href={workHref(w.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit', textDecoration: 'none', minHeight: 44 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- R2 thumbnails, same as the inventory list
        <img src={src} alt="" width={56} height={56} style={{ width: 56, height: 56, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--bd)' }} />
      ) : null}
      <span style={{ fontSize: 13, minWidth: 0, overflowWrap: 'anywhere' }}>
        #{w.id} {w.title?.trim() || untitled}
      </span>
    </Link>
  )
}
