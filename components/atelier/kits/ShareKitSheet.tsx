'use client'

// « Partager à un collectionneur… » (TODO 11b, Pem build GO 2026-11-18). One sheet: collector, works frozen in
// order (public only), price ticks (« sur demande » by default), FR/EN, message, valid until (14 days), then
// « Créer le lien » → link + PDF, Copier / Partager. Opened from a working group, an Inventory selection or a
// contact card. The app sends nothing.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { interpolateMessage } from '@/lib/i18n/message-core'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { toast } from '@/lib/ui/toast'
import { PemModalOverlay } from '@/components/shared/PemModalOverlay'
import {
  KIT_DEFAULT_DAYS,
  KIT_MAX_WORKS,
  KIT_MESSAGE_MAX,
  formatKitPrice,
  kitPublicUrl,
  type KitContactHit,
  type KitDraftWork,
  type KitGroupHit,
  type KitLang,
  type KitSource,
} from '@/lib/collector-kit'
import {
  createCollectorKit,
  getKitContact,
  listKitGroups,
  loadKitDraft,
  remakeKitPdf,
  searchKitContacts,
} from '@/app/atelier/kits/actions'

interface Row {
  work: KitDraftWork
  included: boolean
  showPrice: boolean
}

interface Ready {
  token: string
  expiresAt: string
  workCount: number
  contactName: string
  lang: KitLang
  pdfError: string | null
}

/** YYYY-MM-DD in Paris, `days` from today. */
function parisDay(days: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.now() + days * 86_400_000))
}

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || window.location.origin
}

const LABEL: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--tx3)', fontWeight: 600, margin: '18px 0 6px',
}
const FIELD: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 12px', fontSize: 16,
  background: 'var(--bg0)', border: '1px solid var(--bd2, var(--bd))', borderRadius: 4, color: 'var(--tx)',
}

export function ShareKitSheet({ source, onClose }: { source: KitSource; onClose: () => void }) {
  const { t, lang: uiLang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const locale = uiLang === 'en' ? 'en-GB' : 'fr-FR'

  const [contact, setContact] = useState<KitContactHit | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<KitContactHit[] | null>(null)
  const [groups, setGroups] = useState<KitGroupHit[] | null>(null)
  const [groupId, setGroupId] = useState<string | null>(source.kind === 'group' ? source.groupId : null)
  const [groupName, setGroupName] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[] | null>(source.kind === 'contact' ? [] : null)
  const [kitLang, setKitLang] = useState<KitLang>(uiLang === 'en' ? 'en' : 'fr')
  const [message, setMessage] = useState('')
  const [validUntil, setValidUntil] = useState(() => parisDay(KIT_DEFAULT_DAYS))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ready, setReady] = useState<Ready | null>(null)
  const searchSeq = useRef(0)

  // Contact card door: the collector is fixed, pick a group.
  useEffect(() => {
    if (source.kind !== 'contact') return
    void getKitContact(source.contactId).then(setContact)
    void listKitGroups().then(setGroups)
  }, [source])

  // Works for the chosen group / selection.
  const draftSource: KitSource | null = useMemo(() => {
    if (source.kind === 'works') return source
    if (groupId) return { kind: 'group', groupId }
    return null
  }, [source, groupId])

  useEffect(() => {
    if (!draftSource) return
    let alive = true
    setRows(null)
    void loadKitDraft(draftSource).then((res) => {
      if (!alive) return
      if ('error' in res) { setErr(res.error); setRows([]); return }
      setGroupName(res.groupName)
      let n = 0
      setRows(res.works.map((work) => {
        const included = work.isPublic && n < KIT_MAX_WORKS
        if (included) n += 1
        return { work, included, showPrice: false }
      }))
    })
    return () => { alive = false }
  }, [draftSource])

  // Collector search (debounced).
  useEffect(() => {
    if (contact) return
    const q = query.trim()
    if (q.length < 2) { setHits(null); return }
    const seq = ++searchSeq.current
    const id = window.setTimeout(() => {
      void searchKitContacts(q).then((res) => { if (seq === searchSeq.current) setHits(res) })
    }, 220)
    return () => window.clearTimeout(id)
  }, [query, contact])

  const included = (rows ?? []).filter((r) => r.included)
  const publicCount = (rows ?? []).filter((r) => r.work.isPublic).length
  const tooMany = included.length > KIT_MAX_WORKS
  const canCreate = Boolean(contact) && included.length > 0 && !tooMany && !busy && validUntil >= parisDay(0)

  function move(i: number, d: -1 | 1) {
    setRows((prev) => {
      if (!prev) return prev
      const j = i + d
      if (j < 0 || j >= prev.length) return prev
      const next = prev.slice()
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  function patch(i: number, p: Partial<Row>) {
    setRows((prev) => (prev ? prev.map((r, k) => (k === i ? { ...r, ...p } : r)) : prev))
  }

  async function create() {
    if (!contact) { setErr(t('ck_err_no_contact')); return }
    setBusy(true)
    setErr(null)
    const res = await createCollectorKit({
      contactId: contact.contactId,
      groupId,
      works: included.map((r) => ({ oeuvreId: r.work.oeuvreId, showPrice: r.showPrice })),
      lang: kitLang,
      message,
      validUntil,
    })
    setBusy(false)
    if ('error' in res) {
      const known: Record<string, string> = {
        bad_date: t('ck_err_bad_date'),
        no_contact: t('ck_err_no_contact'),
        no_works: t('ck_err_no_works'),
        not_public: t('ck_err_not_public'),
        too_many: interpolateMessage(t('ck_too_many_fmt'), { max: KIT_MAX_WORKS }),
      }
      setErr(known[res.error] ?? interpolateMessage(t('ck_err_generic_fmt'), { error: res.error }))
      return
    }
    setReady({ ...res, lang: kitLang })
  }

  const title = ready ? t('ck_ready_title') : t('ck_sheet_title')
  const subtitle = ready
    ? interpolateMessage(t('ck_ready_meta_fmt'), {
        name: ready.contactName,
        count: ready.workCount,
        lang: ready.lang.toUpperCase(),
        date: new Date(ready.expiresAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }),
      })
    : source.kind === 'contact'
      ? t('ck_from_contact')
      : source.kind === 'works'
        ? interpolateMessage(t('ck_from_selection_fmt'), { count: rows?.length ?? source.oeuvreIds.length })
        : interpolateMessage(t('ck_from_group_fmt'), { name: groupName ?? '…', count: rows?.length ?? 0 })

  return (
    <PemModalOverlay
      onClose={() => { if (!busy) onClose() }}
      panelStyle={narrow
        ? { width: '100vw', height: '100dvh', display: 'flex', flexDirection: 'column', border: 'none' }
        : { width: 'min(620px, 94vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: 8 }}
    >
      <div data-testid="share-kit-sheet" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: narrow ? 'max(14px, env(safe-area-inset-top)) 16px 16px' : '20px 24px' }}>
        <div className="serif" style={{ fontSize: 24, lineHeight: 1.15 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 4 }}>{subtitle}</div>

        {ready ? (
          <ReadyPane ready={ready} onError={setErr} />
        ) : (
          <>
            <div style={LABEL}>{t('ck_collector')}</div>
            {contact ? (
              <div style={{ ...FIELD, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.name}</span>
                {source.kind !== 'contact' ? (
                  <button type="button" className="btn ghost sm" style={{ minHeight: 44, flexShrink: 0 }} onClick={() => { setContact(null); setQuery('') }}>
                    {t('ck_collector_change')}
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('ck_collector_search_ph')}
                  style={FIELD}
                  data-testid="share-kit-contact-search"
                />
                {hits && hits.length > 0 ? (
                  <div style={{ border: '1px solid var(--bd)', borderTop: 'none', borderRadius: '0 0 4px 4px' }}>
                    {hits.map((h) => (
                      <button
                        key={h.contactId}
                        type="button"
                        onClick={() => { setContact(h); setHits(null) }}
                        style={{ display: 'flex', width: '100%', minHeight: 44, alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--bd)', color: 'var(--tx)', textAlign: 'left', cursor: 'pointer', fontSize: 14 }}
                      >
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                        {h.hint ? <span style={{ fontSize: 12, color: 'var(--tx3)', flexShrink: 0 }}>{h.hint}</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 6 }}>
                  {hits && hits.length === 0 ? `${t('ck_collector_none')} ` : ''}{t('ck_collector_hint')}
                </div>
              </>
            )}

            {source.kind === 'contact' ? (
              <>
                <div style={LABEL}>{t('ck_group_pick')}</div>
                {groups && groups.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--tx3)' }}>{t('ck_group_none')}</div>
                ) : (
                  <select value={groupId ?? ''} onChange={(e) => setGroupId(e.target.value || null)} style={FIELD} data-testid="share-kit-group">
                    <option value="">{groups ? t('ck_group_pick_ph') : t('ck_loading')}</option>
                    {(groups ?? []).map((g) => (
                      <option key={g.id} value={g.id}>{`${g.name} (${g.count})`}</option>
                    ))}
                  </select>
                )}
              </>
            ) : null}

            {draftSource ? (
              <>
                <div style={LABEL}>{t('ck_works')}</div>
                <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 6 }}>{t('ck_works_help')}</div>
                {rows == null ? (
                  <div style={{ fontSize: 13, color: 'var(--tx3)', padding: '10px 0' }}>{t('ck_loading')}</div>
                ) : rows.length > 0 && publicCount === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--rust)', padding: '10px 0' }}>{t('ck_nothing_public')}</div>
                ) : null}
                {(rows ?? []).map((r, i) => (
                  <WorkRow
                    key={r.work.oeuvreId}
                    row={r}
                    index={i}
                    last={i === (rows?.length ?? 0) - 1}
                    lang={kitLang}
                    onToggle={(v) => patch(i, { included: v })}
                    onPrice={(v) => patch(i, { showPrice: v })}
                    onMove={(d) => move(i, d)}
                  />
                ))}
                {tooMany ? (
                  <div style={{ fontSize: 12, color: 'var(--rust)', marginTop: 8 }}>
                    {interpolateMessage(t('ck_too_many_fmt'), { max: KIT_MAX_WORKS })}
                  </div>
                ) : null}
              </>
            ) : null}

            <div style={LABEL}>{t('ck_lang')}</div>
            <div role="radiogroup" aria-label={t('ck_lang')} style={{ display: 'flex', border: '1px solid var(--bd)', borderRadius: 4, overflow: 'hidden' }}>
              {(['fr', 'en'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={kitLang === l}
                  onClick={() => setKitLang(l)}
                  style={{ flex: 1, minHeight: 44, border: 'none', cursor: 'pointer', fontSize: 13, background: kitLang === l ? 'var(--bg3, var(--bg2))' : 'transparent', color: kitLang === l ? 'var(--tx)' : 'var(--tx3)' }}
                >
                  {l === 'fr' ? t('ck_lang_fr') : t('ck_lang_en')}
                </button>
              ))}
            </div>

            <div style={LABEL}>{t('ck_message')}</div>
            <textarea
              value={message}
              maxLength={KIT_MESSAGE_MAX}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('ck_message_ph')}
              rows={3}
              style={{ ...FIELD, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
            />

            <div style={LABEL}>{t('ck_valid_until')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="date"
                value={validUntil}
                min={parisDay(1)}
                onChange={(e) => setValidUntil(e.target.value)}
                style={{ ...FIELD, flex: 1 }}
              />
              <span style={{ fontSize: 12, color: 'var(--tx3)', flexShrink: 0 }}>
                {interpolateMessage(t('ck_days_fmt'), {
                  count: Math.max(0, Math.round((Date.parse(`${validUntil}T12:00:00Z`) - Date.parse(`${parisDay(0)}T12:00:00Z`)) / 86_400_000)),
                })}
              </span>
            </div>
          </>
        )}

        {err ? <div role="alert" style={{ fontSize: 13, color: 'var(--rust)', marginTop: 14 }}>{err}</div> : null}
      </div>

      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          gap: 10,
          borderTop: '1px solid var(--bd)',
          padding: narrow ? '12px 16px max(12px, env(safe-area-inset-bottom))' : '12px 24px',
          background: 'var(--bg1)',
        }}
      >
        {ready ? (
          <button type="button" className="btn" style={{ flex: 1, minHeight: 44 }} onClick={onClose}>{t('ck_close')}</button>
        ) : (
          <>
            <button type="button" className="btn ghost" style={{ flex: 1, minHeight: 44 }} onClick={onClose} disabled={busy}>{t('ck_cancel')}</button>
            <button type="button" className="btn primary" style={{ flex: 2, minHeight: 44 }} onClick={() => void create()} disabled={!canCreate} data-testid="share-kit-create">
              {busy ? t('ck_creating') : t('ck_create')}
            </button>
          </>
        )}
      </div>
    </PemModalOverlay>
  )
}

function WorkRow({
  row, index, last, lang, onToggle, onPrice, onMove,
}: {
  row: Row
  index: number
  last: boolean
  lang: KitLang
  onToggle: (v: boolean) => void
  onPrice: (v: boolean) => void
  onMove: (d: -1 | 1) => void
}) {
  const { t } = useI18n()
  const w = row.work
  const title = w.title?.trim() || `#${w.oeuvreId}`
  const meta = [w.title?.trim() ? `#${w.oeuvreId}` : null, w.year, w.size].filter(Boolean).join(' · ')
  const dim = !row.included
  const arrowBtn: React.CSSProperties = { width: 28, minHeight: 44, background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 14, padding: 0 }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--bd)', minWidth: 0 }}>
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, minHeight: 44, flexShrink: 0, cursor: w.isPublic ? 'pointer' : 'default' }}>
        <input
          type="checkbox"
          checked={row.included}
          disabled={!w.isPublic}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={interpolateMessage(t('ck_include_work_fmt'), { title })}
          style={{ width: 20, height: 20, accentColor: 'var(--ac)' }}
        />
      </label>
      {w.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={w.thumb} alt="" width={40} height={40} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 2, flexShrink: 0, opacity: dim ? 0.4 : 1 }} />
      ) : (
        <div style={{ width: 40, height: 40, background: 'var(--bg3, var(--bg2))', borderRadius: 2, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0, color: dim ? 'var(--tx3)' : 'var(--tx)' }}>
        <div style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {w.isPublic ? meta : `${meta} · ${t('ck_private_excluded')}`}
        </div>
      </div>
      {w.isPublic ? (
        w.price != null ? (
          <button
            type="button"
            aria-pressed={row.showPrice}
            disabled={!row.included}
            onClick={() => onPrice(!row.showPrice)}
            title={interpolateMessage(t('ck_price_show_fmt'), { price: formatKitPrice(w.price, lang) })}
            style={{ minHeight: 44, minWidth: 72, flexShrink: 0, background: 'none', border: `1px solid ${row.showPrice ? 'var(--ac)' : 'var(--bd)'}`, borderRadius: 4, color: row.showPrice ? 'var(--ac)' : 'var(--tx3)', fontSize: 12, cursor: 'pointer', padding: '0 8px' }}
          >
            {row.showPrice ? formatKitPrice(w.price, lang) : t('ck_price_on_request')}
          </button>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--tx3)', flexShrink: 0 }}>{t('ck_no_price')}</span>
        )
      ) : null}
      <div style={{ display: 'flex', flexShrink: 0 }}>
        <button type="button" aria-label={t('ck_move_up')} disabled={index === 0} onClick={() => onMove(-1)} style={arrowBtn}>↑</button>
        <button type="button" aria-label={t('ck_move_down')} disabled={last} onClick={() => onMove(1)} style={arrowBtn}>↓</button>
      </div>
    </div>
  )
}

function ReadyPane({ ready, onError }: { ready: Ready; onError: (e: string | null) => void }) {
  const { t } = useI18n()
  const [pdfError, setPdfError] = useState(ready.pdfError)
  const [remaking, setRemaking] = useState(false)
  const url = kitPublicUrl(ready.token, siteOrigin())
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('ck_copied'))
      // eslint-disable-next-line pem-i18n/no-silent-catch -- shown in the sheet; the link box is selectable
    } catch {
      onError(t('ck_copy_failed'))
    }
  }

  async function share() {
    try {
      await navigator.share({ url, text: interpolateMessage(t('ck_share_text_fmt'), { name: ready.contactName }) })
    // eslint-disable-next-line pem-i18n/no-silent-catch -- the person closed the phone's share sheet
    } catch {
      /* the person closed the share sheet */
    }
  }

  async function remake() {
    setRemaking(true)
    const res = await remakeKitPdf(ready.token)
    setRemaking(false)
    if ('error' in res) { setPdfError(res.error); return }
    setPdfError(null)
    toast.success(t('ck_pdf_remade'))
  }

  return (
    <>
      <div
        data-testid="share-kit-link"
        style={{ border: '1px dashed var(--ac2, var(--ac))', borderRadius: 4, padding: 12, fontSize: 13, color: 'var(--ac)', wordBreak: 'break-all', marginTop: 16, userSelect: 'all' }}
      >
        {url}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <button type="button" className="btn" style={{ flex: 1, minHeight: 44 }} onClick={() => void copy()}>{t('ck_copy')}</button>
        {canShare ? (
          <button type="button" className="btn primary" style={{ flex: 1, minHeight: 44 }} onClick={() => void share()}>{t('ck_share')}</button>
        ) : null}
      </div>
      <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 8 }}>{t('ck_ready_send')}</div>

      <div style={LABEL}>{t('ck_pdf')}</div>
      {pdfError ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--rust)', flex: 1, minWidth: 0 }}>{interpolateMessage(t('ck_pdf_failed_fmt'), { error: pdfError })}</span>
          <button type="button" className="btn sm" style={{ minHeight: 44 }} disabled={remaking} onClick={() => void remake()}>
            {remaking ? '…' : t('ck_pdf_remake')}
          </button>
        </div>
      ) : (
        <a className="btn ghost" href={`/c/${ready.token}/pdf`} style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {t('ck_pdf_ready')}
        </a>
      )}
      <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 8, lineHeight: 1.45 }}>{t('ck_pdf_note')}</div>
    </>
  )
}
