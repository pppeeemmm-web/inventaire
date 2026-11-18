'use client'

// Collector kit page /c/<token> (TODO 11b). No atelier chrome; one work per screen on the phone;
// sticky « Écrire à l'atelier » + « PDF ». Copy comes resolved from the server in the KIT's language
// (`collectorKitPageMessages`), so this view never reads the viewer's stored language.

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { interpolateMessage } from '@/lib/i18n/message-core'
import type { collectorKitPageMessages } from '@/lib/i18n/messages/collector-kit.messages'
import { formatKitPrice, type KitLang } from '@/lib/collector-kit'
import type { KitPageWork } from '@/app/c/[token]/kit-data'
import { sendKitEnquiry } from '@/app/c/[token]/actions'

export type CollectorKitCopy = { [K in keyof typeof collectorKitPageMessages]: string }

interface Props {
  token: string
  lang: KitLang
  copy: CollectorKitCopy
  name: string | null
  message: string | null
  expiresAt: string | null
  works: KitPageWork[]
  hasPdf: boolean
}

function fmtDate(iso: string | null, lang: KitLang): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris',
  })
}

export function CollectorKitView({ token, lang, copy, name, message, expiresAt, works, hasPdf }: Props) {
  const [zoom, setZoom] = useState<string | null>(null)
  const [sheetFor, setSheetFor] = useState<number[] | null>(null)
  const until = fmtDate(expiresAt, lang)
  const hasPrices = works.some((w) => w.price != null)

  useEffect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom])

  return (
    <div className="ck-root">
      <div className="ck-wrap">
        <nav className="ck-top" aria-label={copy.ckp_lang}>
          <a href="?lang=fr" aria-current={lang === 'fr'} hrefLang="fr">FR</a>
          <a href="?lang=en" aria-current={lang === 'en'} hrefLang="en">EN</a>
        </nav>

        <header className="ck-hdr">
          <div className="ck-eyebrow">{copy.ckp_eyebrow}</div>
          <h1 className="ck-h1">{name ? interpolateMessage(copy.ckp_for_fmt, { name }) : copy.ckp_selection}</h1>
          {message ? <p className="ck-msg">{lang === 'en' ? `“${message}”` : `« ${message} »`}</p> : null}
          <div className="ck-valid">
            {interpolateMessage(works.length === 1 ? copy.ckp_meta_one_fmt : copy.ckp_meta_fmt, { count: works.length, date: until })}
          </div>
        </header>

        {works.length === 0 ? <p className="ck-empty">{copy.ckp_empty}</p> : null}

        <div className="ck-works">
          {works.map((w) => {
            const gone = w.availability === 'sold' || w.availability === 'unavailable'
            const title = w.title?.trim() || copy.ckp_untitled
            const line = [w.year, w.technique, w.size].filter(Boolean).join(' · ')
            return (
              <article key={w.oeuvreId} className={`ck-work${gone ? ' ck-work--gone' : ''}`} data-testid="ck-work">
                {w.image ? (
                  <button type="button" className="ck-img-btn" onClick={() => setZoom(w.image)} aria-label={`${copy.ckp_zoom} — ${title}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="ck-img" src={w.image} alt={title} loading="lazy" decoding="async" />
                  </button>
                ) : (
                  <div className="ck-img-ph" />
                )}
                <div className="ck-meta">
                  <h2 className="ck-h2">{title}</h2>
                  {line ? <div className="ck-line">{line}</div> : null}
                  {!gone && (w.price != null ? (
                    <div className="ck-price">
                      {formatKitPrice(w.price, lang)}
                      <small>{copy.ckp_price_note}</small>
                    </div>
                  ) : (
                    <div className="ck-price-req">{copy.ckp_price_on_request}</div>
                  ))}
                  {w.availability ? (
                    <div className={`ck-avail ck-avail--${w.availability}`}>
                      {w.availability === 'available' ? copy.ckp_available
                        : w.availability === 'reserved' ? copy.ckp_reserved
                          : w.availability === 'sold' ? copy.ckp_sold
                            : copy.ckp_unavailable}
                    </div>
                  ) : null}
                  {!gone ? (
                    <button type="button" className="ck-btn ck-btn--wide" onClick={() => setSheetFor([w.oeuvreId])}>
                      {copy.ckp_interest}
                    </button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>

        <footer className="ck-foot">
          <div>{copy.ckp_footer_personal}</div>
          <div>{copy.ckp_footer_data}</div>
          {hasPrices ? <div>{interpolateMessage(copy.ckp_footer_prices_fmt, { date: until })}</div> : null}
          <div>{copy.ckp_footer_copyright}</div>
          <div><Link href="/">{copy.ckp_site_link}</Link></div>
        </footer>
      </div>

      <div className="ck-bar">
        <div className="ck-bar-in">
          {hasPdf ? (
            <a className="ck-btn ck-btn--ghost" href={`/c/${token}/pdf`} rel="nofollow" data-testid="ck-pdf">{copy.ckp_pdf}</a>
          ) : null}
          <button type="button" className="ck-btn ck-btn--fill" onClick={() => setSheetFor([])} data-testid="ck-write">
            {copy.ckp_write}
          </button>
        </div>
      </div>

      {zoom ? (
        <button type="button" className="ck-zoom" onClick={() => setZoom(null)} aria-label={copy.ckp_close}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" />
        </button>
      ) : null}

      {sheetFor ? (
        <EnquirySheet
          token={token}
          copy={copy}
          works={works.filter((w) => w.availability !== 'sold' && w.availability !== 'unavailable')}
          initial={sheetFor}
          onClose={() => setSheetFor(null)}
        />
      ) : null}
    </div>
  )
}

function EnquirySheet({
  token, copy, works, initial, onClose,
}: {
  token: string
  copy: CollectorKitCopy
  works: KitPageWork[]
  initial: number[]
  onClose: () => void
}) {
  const [picked, setPicked] = useState<Set<number>>(() => new Set(initial))
  const prefill = useMemo(() => {
    if (initial.length === 1) {
      const w = works.find((x) => x.oeuvreId === initial[0])
      if (w) return interpolateMessage(copy.ckp_prefill_one_fmt, { title: w.title?.trim() || copy.ckp_untitled, id: w.oeuvreId })
    }
    return initial.length > 1 ? copy.ckp_prefill_many : copy.ckp_prefill_none
  }, [initial, works, copy])
  const [text, setText] = useState(prefill)
  const [reply, setReply] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && state !== 'sending') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, state])

  async function send() {
    if (!text.trim()) { setErr(copy.ckp_err_empty); return }
    setState('sending')
    setErr(null)
    const res = await sendKitEnquiry({ token, oeuvreIds: [...picked], message: text, reply })
    if ('ok' in res) { setState('sent'); return }
    setState('idle')
    setErr(res.error === 'limit' ? copy.ckp_err_limit
      : res.error === 'inactive' ? copy.ckp_err_inactive
        : res.error === 'empty' ? copy.ckp_err_empty
          : copy.ckp_err_failed)
  }

  return (
    <div className="ck-dim" role="presentation" onClick={() => state !== 'sending' && onClose()}>
      <div className="ck-sheet" role="dialog" aria-modal="true" aria-label={copy.ckp_write} onClick={(e) => e.stopPropagation()}>
        <div className="ck-grab" />
        <h3 className="ck-h3">{copy.ckp_write}</h3>
        {state === 'sent' ? (
          <>
            <p className="ck-note" role="status">{copy.ckp_sent}</p>
            <div className="ck-row">
              <button type="button" className="ck-btn ck-btn--fill" onClick={onClose}>{copy.ckp_close}</button>
            </div>
          </>
        ) : (
          <>
            {works.length > 0 ? (
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="ck-label">{copy.ckp_works_label}</legend>
                {works.map((w) => (
                  <label key={w.oeuvreId} className="ck-pick">
                    <input
                      type="checkbox"
                      checked={picked.has(w.oeuvreId)}
                      onChange={(e) => setPicked((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(w.oeuvreId)
                        else next.delete(w.oeuvreId)
                        return next
                      })}
                    />
                    <span>{`${w.title?.trim() || copy.ckp_untitled} · #${w.oeuvreId}`}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            <label className="ck-label" htmlFor="ck-msg">{copy.ckp_message_label}</label>
            <textarea id="ck-msg" className="ck-ta" value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} />
            <label className="ck-label" htmlFor="ck-reply">{copy.ckp_reply_label}</label>
            <input
              id="ck-reply"
              className="ck-input"
              value={reply}
              maxLength={200}
              autoComplete="email"
              placeholder={copy.ckp_reply_ph}
              onChange={(e) => setReply(e.target.value)}
            />
            {err ? <p className="ck-note ck-note--err" role="alert">{err}</p> : null}
            <div className="ck-row">
              <button type="button" className="ck-btn ck-btn--ghost" onClick={onClose} disabled={state === 'sending'}>{copy.ckp_cancel}</button>
              <button type="button" className="ck-btn ck-btn--fill" onClick={() => void send()} disabled={state === 'sending'}>
                {state === 'sending' ? copy.ckp_sending : copy.ckp_send}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
