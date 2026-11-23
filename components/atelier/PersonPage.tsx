'use client'

// The person page (People.md §5, step 3 — reads only). Shown on /atelier/contacts when a contact is opened;
// « Modifier » opens the existing editor (door saveContact, unchanged). Desk: works + orders + papers + Journal in
// the middle, details in a rail. Phone: name, Appeler / Écrire, works strip (the only sideways scroll), details
// folded, sticky « Modifier » bar. Every block reads for itself, paged, counts from the database.

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { thumbUrl } from '@/lib/data'
import { formatPriceFull } from '@/lib/format-price'
import { contactPersonProseName } from '@/lib/contacts/contact-display'
import { contactLinks, LINK_GLYPH } from '@/lib/contacts/contact-links'
import { ContactJournalSection } from '@/components/atelier/ContactJournalSection'
import {
  readPersonOrders,
  readPersonPapers,
  readPersonSeen,
  readPersonWorks,
  type PersonOrder,
  type PersonPaper,
  type PersonWork,
} from '@/app/atelier/(portal)/contacts/person-page'
import { PersonTimeline } from '@/components/atelier/PersonTimeline'
import type {
  ContactAddress,
  ContactEmail,
  ContactPhone,
  ContactRow,
  ContactSocial,
  ContactWebsite,
} from '@/components/atelier/contact-editor-types'

type Props = {
  contact: ContactRow
  emails: ContactEmail[]
  phones: ContactPhone[]
  addresses: ContactAddress[]
  websites: ContactWebsite[]
  socials: ContactSocial[]
  isAdmin: boolean
  narrow: boolean
  onEdit: () => void
  onBack: () => void
  onDelete: () => void
}

type Paged<T> = { items: T[]; count: number; failed: boolean; loading: boolean }

/** A paged read for one block: first page on mount / contact change, « more » appends the next page. */
function usePaged<T>(reader: (offset: number) => Promise<{ ok: true; count: number; items: T[] } | { error: string }>, key: string, enabled = true) {
  const [state, setState] = useState<Paged<T>>({ items: [], count: 0, failed: false, loading: enabled })
  useEffect(() => {
    if (!enabled) {
      setState({ items: [], count: 0, failed: false, loading: false })
      return
    }
    let live = true
    setState({ items: [], count: 0, failed: false, loading: true })
    void reader(0).then((res) => {
      if (!live) return
      setState('error' in res ? { items: [], count: 0, failed: true, loading: false } : { items: res.items, count: res.count, failed: false, loading: false })
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])
  const more = useCallback(() => {
    setState((s) => ({ ...s, loading: true }))
    void reader(state.items.length).then((res) => {
      setState((s) => ('error' in res ? { ...s, failed: true, loading: false } : { items: [...s.items, ...res.items], count: res.count, failed: false, loading: false }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.items.length, key])
  return { ...state, more }
}

const LABEL: React.CSSProperties = { fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tx3)' }
const TILE = 64

function WorkStrip({
  contactId,
  rel,
  label,
  narrow,
  reader,
}: {
  contactId: number
  rel: string
  label: string
  narrow: boolean
  reader: (offset: number) => Promise<{ ok: true; count: number; items: PersonWork[] } | { error: string }>
}) {
  const { t } = useI18n()
  const { items: raw, count, failed, loading, more } = usePaged<PersonWork>(reader, `${contactId}-${rel}`)
  // « Vu » counts showings: the same work sent twice shows one thumb.
  const items = raw.filter((w, i) => raw.findIndex((x) => x.id === w.id) === i)
  return (
    <div style={{ marginBottom: 14 }} data-testid={`person-works-${rel}`}>
      <div style={{ ...LABEL, marginBottom: 6 }}>
        {label} · {loading && items.length === 0 ? '…' : count}
      </div>
      {failed ? (
        <div style={{ fontSize: 12, color: 'var(--rust)' }}>{t('pp_works_err')}</div>
      ) : !loading && count === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('pp_works_none')}</div>
      ) : (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: narrow ? 'nowrap' : 'wrap',
            overflowX: narrow ? 'auto' : 'visible',
            paddingBottom: narrow ? 4 : 0,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {items.map((w) => {
            const src = thumbUrl(w.image)
            return (
              <Link
                key={w.id}
                href={`/atelier/inventory?work=${w.id}`}
                aria-label={t('pp_work_open_fmt').replace('{id}', String(w.id))}
                title={`#${w.id}${w.title ? ` ${w.title}` : ''}`}
                style={{
                  flex: '0 0 auto',
                  width: TILE,
                  minHeight: 44,
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                <span style={{ display: 'block', width: TILE, height: TILE, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" width={TILE} height={TILE} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                </span>
                <span className="t-mono-sm" style={{ display: 'block', fontSize: 9, color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  #{w.id}
                </span>
              </Link>
            )
          })}
          {raw.length < count ? (
            <button
              type="button"
              className="btn ghost sm"
              onClick={more}
              disabled={loading}
              style={{ flex: '0 0 auto', width: TILE, height: TILE, minHeight: 44 }}
            >
              {loading ? '…' : `+${count - raw.length}`}
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}

const ORDER_KINDS = ['sale', 'consignment', 'loan', 'gift', 'entrusted']
const ORDER_STATUSES = ['draft', 'signed', 'deposit_paid', 'paid', 'delivered', 'out', 'closed', 'handed_over', 'cancelled', 'returned']

/** A folded block (collapsed by default, like the Journal fold): its read starts when it opens, 10 rows at a time. */
function ListBlock<T>({
  title,
  testId,
  reader,
  pageKey,
  empty,
  row,
}: {
  title: string
  testId: string
  reader: (offset: number) => Promise<{ ok: true; count: number; items: T[] } | { error: string }>
  pageKey: string
  empty: string
  row: (x: T) => React.ReactNode
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    setOpen(false)
  }, [pageKey])
  const { items, count, failed, loading, more } = usePaged<T>(reader, pageKey, open)
  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--bd)', paddingTop: 8 }} data-testid={testId}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--tx)', cursor: 'pointer', padding: 0, textAlign: 'left' }}
      >
        <span style={{ fontSize: 10, color: 'var(--tx3)' }}>{open ? '▾' : '▸'}</span>
        <span style={LABEL}>{title}</span>
        {open && !loading && !failed ? <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>{count}</span> : null}
      </button>
      {open ? (
        failed ? (
          <div style={{ fontSize: 12, color: 'var(--rust)' }}>{t('pp_list_err')}</div>
        ) : loading && items.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--tx3)', padding: '4px 0 8px' }}>{t('pp_loading')}</div>
        ) : count === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--tx3)', padding: '4px 0 8px' }}>{empty}</div>
        ) : (
          items.map(row)
        )
      ) : null}
      {open && items.length < count ? (
        <button type="button" className="btn ghost sm" onClick={more} disabled={loading} style={{ minHeight: 44, marginTop: 6 }}>
          {loading ? t('pp_loading') : t('pp_list_more')}
        </button>
      ) : null}
    </div>
  )
}

const ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 44,
  padding: '6px 0',
  borderBottom: '1px solid var(--bd)',
  fontSize: 12,
  color: 'inherit',
  textDecoration: 'none',
  minWidth: 0,
}

function telHref(p: ContactPhone): string {
  const cc = (p.country_code ?? '').replace(/[^\d+]/g, '')
  const num = p.phone.replace(/[^\d+]/g, '')
  return num.startsWith('+') || !cc ? num : `${cc.startsWith('+') ? cc : `+${cc}`}${num.replace(/^0/, '')}`
}

export function PersonPage({ contact, emails, phones, addresses, websites, socials, isAdmin, narrow, onEdit, onBack, onDelete }: Props) {
  const { t, lang } = useI18n()
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const id = contact.ContactID
  const [menu, setMenu] = useState(false)
  const [folded, setFolded] = useState(false)

  useEffect(() => {
    setMenu(false)
    setFolded(false)
  }, [id])


  const person = contactPersonProseName(contact)
  const inst = (contact.NomInstitution ?? '').trim()
  const name = person || inst || `#${id}`
  const sub = person && inst ? inst : ''

  const mail = emails.find((e) => e.is_primary && e.email.trim()) ?? emails.find((e) => e.email.trim())
  const phone = phones.find((p) => p.is_primary && p.phone.trim()) ?? phones.find((p) => p.phone.trim())
  const links = contactLinks(websites, socials)
  const day = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  const key = (prefix: string, v: string, list: string[]) => (list.includes(v) ? t(`${prefix}${v}` as DictKey) : v)

  const detailRows = (
    <div data-testid="person-details" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
      {emails.filter((e) => e.email.trim()).map((e, i) => (
        <div key={`e${e.id ?? i}`} style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44, minWidth: 0 }}>
          <span className="t-mono-sm" style={{ color: 'var(--tx3)', width: 60, flexShrink: 0 }}>{e.label}</span>
          <a href={`mailto:${e.email.trim()}`} style={{ color: 'var(--ac)', overflowWrap: 'anywhere' }}>{e.email.trim()}</a>
        </div>
      ))}
      {phones.filter((p) => p.phone.trim()).map((p, i) => (
        <div key={`p${p.id ?? i}`} style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}>
          <span className="t-mono-sm" style={{ color: 'var(--tx3)', width: 60, flexShrink: 0 }}>{p.label}</span>
          <a href={`tel:${telHref(p)}`} style={{ color: 'var(--ac)' }}>{`${p.country_code ?? ''} ${p.phone}`.trim()}</a>
        </div>
      ))}
      {addresses.map((a, i) => {
        const line = [a.adresse, [a.code_postal, a.ville].filter(Boolean).join(' '), a.pays].filter((x) => x && String(x).trim()).join(', ')
        if (!line) return null
        return (
          <div key={`a${a.id ?? i}`} style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44, minWidth: 0 }}>
            <span className="t-mono-sm" style={{ color: 'var(--tx3)', width: 60, flexShrink: 0 }}>{a.label}</span>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(line)}`}
              target="_blank"
              rel="noopener noreferrer"
              title={t('pp_map_open')}
              style={{ color: 'var(--ac)', overflowWrap: 'anywhere' }}
            >
              {line}
            </a>
          </div>
        )
      })}
      {links.map((l, i) => (
        <div key={`l${i}`} style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44, minWidth: 0 }}>
          <span style={{ width: 60, flexShrink: 0, color: 'var(--tx3)' }}>{LINK_GLYPH[l.kind] ?? '↗'}</span>
          <a href={l.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ac)', overflowWrap: 'anywhere' }}>{l.label}</a>
        </div>
      ))}
      {!emails.length && !phones.length && !addresses.length && !links.length ? (
        <div style={{ color: 'var(--tx3)' }}>{t('pp_contact_none')}</div>
      ) : null}
      {contact.PersonneResponsable ? (
        <div style={{ marginTop: 4 }}>
          <div style={LABEL}>{t('pp_responsible')}</div>
          <div>{contact.PersonneResponsable}{contact.RoleResponsable ? ` · ${contact.RoleResponsable}` : ''}</div>
        </div>
      ) : null}
      {contact.Notes?.trim() ? (
        <div style={{ marginTop: 4 }}>
          <div style={LABEL}>{t('pp_notes')}</div>
          <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{contact.Notes}</div>
        </div>
      ) : null}
    </div>
  )

  const moreButton = (
    <button type="button" className="btn ghost sm" aria-label={t('pp_more')} aria-expanded={menu} data-testid="person-more" onClick={() => setMenu((v) => !v)} style={{ minHeight: narrow ? 44 : undefined, minWidth: narrow ? 44 : undefined }}>⋯</button>
  )
  const menuPanel = (side: 'top' | 'bottom') =>
    menu ? (
      <div style={{ position: 'absolute', right: 0, ...(side === 'top' ? { top: '100%' } : { bottom: '100%' }), zIndex: 5, minWidth: 200, background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 4, padding: 4, display: 'flex', flexDirection: 'column' }}>
        <Link href={`/atelier/sales?new=sale&party=${id}`} className="btn ghost sm" style={{ justifyContent: 'flex-start', minHeight: narrow ? 44 : undefined }}>{t('pp_new_order')}</Link>
        <button type="button" className="btn ghost sm" onClick={() => { setMenu(false); onDelete() }} style={{ color: 'var(--rust)', justifyContent: 'flex-start', minHeight: narrow ? 44 : undefined }}>{t('delete')}</button>
      </div>
    ) : null

  const pageSide = narrow ? 'max(12px, env(safe-area-inset-left))' : '20px'
  const header = (
    <div style={{ marginBottom: 14 }}>
      {narrow ? (
        <button type="button" className="btn ghost sm" onClick={onBack} data-testid="person-back" style={{ minHeight: 44, marginLeft: -8 }}>
          {t('pp_back')}
        </button>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <h2 data-testid="person-name" style={{ margin: 0, fontSize: narrow ? 20 : 22, lineHeight: 1.2, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
          {name}
          {isAdmin && contact.is_private ? (
            <span
              title={t('contacts_private_chip_title')}
              style={{ marginLeft: 8, border: '1px solid var(--bd)', color: 'var(--tx2)', fontSize: 9, padding: '1px 5px', borderRadius: 2, letterSpacing: 0.5, verticalAlign: 'middle', fontWeight: 400 }}
            >
              {t('contacts_private_chip')}
            </span>
          ) : null}
        </h2>
        {!narrow ? (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, position: 'relative' }}>
            <button type="button" className="btn sm" onClick={onEdit} data-testid="person-edit">{t('pp_edit')}</button>
            {moreButton}
            {menuPanel('top')}
          </div>
        ) : null}
      </div>
      <div style={{ fontSize: 12, color: 'var(--tx2)', marginTop: 4 }}>
        {[sub, contact.Role?.trim(), contact.Actif === false ? t('pp_inactive') : ''].filter(Boolean).join(' · ')}
      </div>
      {narrow ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          {phone ? <a className="btn sm" href={`tel:${telHref(phone)}`} style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t('pp_call')}</a> : <button type="button" className="btn sm" disabled style={{ minHeight: 44 }}>{t('pp_call')}</button>}
          {mail ? <a className="btn sm" href={`mailto:${mail.email.trim()}`} style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t('pp_write')}</a> : <button type="button" className="btn sm" disabled style={{ minHeight: 44 }}>{t('pp_write')}</button>}
        </div>
      ) : null}
    </div>
  )

  const main = (
    <>
      <WorkStrip contactId={id} rel="owns" label={t('pp_works_owns')} narrow={narrow} reader={(o) => readPersonWorks(id, 'owns', o)} />
      <WorkStrip contactId={id} rel="holds" label={t('pp_works_holds')} narrow={narrow} reader={(o) => readPersonWorks(id, 'holds', o)} />
      <WorkStrip contactId={id} rel="bought" label={t('pp_works_bought')} narrow={narrow} reader={(o) => readPersonWorks(id, 'bought', o)} />
      <WorkStrip contactId={id} rel="seen-kit" label={t('pp_works_seen_kit')} narrow={narrow} reader={(o) => readPersonSeen(id, 'kit', o)} />
      <WorkStrip contactId={id} rel="seen-event" label={t('pp_works_seen_event')} narrow={narrow} reader={(o) => readPersonSeen(id, 'event', o)} />

      {narrow ? (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--bd)', paddingTop: 4 }}>
          <button
            type="button"
            aria-expanded={folded}
            onClick={() => setFolded((v) => !v)}
            data-testid="person-details-fold"
            style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--tx)', cursor: 'pointer', padding: 0, textAlign: 'left' }}
          >
            <span style={{ fontSize: 10, color: 'var(--tx3)' }}>{folded ? '▾' : '▸'}</span>
            <span style={LABEL}>{t('pp_contact_phone_tab')}</span>
          </button>
          {folded ? detailRows : null}
        </div>
      ) : null}

      <PersonTimeline contactId={id} narrow={narrow} />

      <ListBlock
        title={t('pp_orders')}
        testId="person-orders"
        reader={(o) => readPersonOrders(id, o)}
        pageKey={`${id}-orders`}
        empty={t('pp_orders_none')}
        row={(o) => (
          <Link key={o.id} href={`/atelier/sales?order=${o.id}`} style={ROW}>
            <span className="t-mono-sm" style={{ color: 'var(--tx3)', width: 78, flexShrink: 0 }}>{day(o.date)}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {key('ord_kind_', o.kind, ORDER_KINDS)}{o.ref ? ` · ${o.ref}` : ''}
            </span>
            <span style={{ color: 'var(--tx3)', flexShrink: 0 }}>{key('ord_st_', o.status, ORDER_STATUSES)}</span>
            {o.priceFinal != null ? <span className="t-mono-sm" style={{ flexShrink: 0 }}>{formatPriceFull(o.priceFinal, lang)}</span> : null}
          </Link>
        )}
      />
      <ListBlock
        title={t('pp_papers')}
        testId="person-papers"
        reader={(o) => readPersonPapers(id, o)}
        pageKey={`${id}-papers`}
        empty={t('pp_papers_none')}
        row={(p) => (
          <Link key={p.id} href="/atelier/vault" style={ROW}>
            <span className="t-mono-sm" style={{ color: 'var(--tx3)', width: 78, flexShrink: 0 }}>{p.date ? day(p.date) : ''}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            {p.kind ? <span style={{ color: 'var(--tx3)', flexShrink: 0 }}>{p.kind}</span> : null}
          </Link>
        )}
      />
      <ContactJournalSection contactId={id} />
    </>
  )

  if (narrow) {
    return (
      <div data-testid="person-page" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, background: 'var(--bg1)' }}>
        <div style={{ flex: 1, overflowX: 'hidden', padding: `8px max(12px, env(safe-area-inset-right)) 16px ${pageSide}` }}>
          {header}
          {main}
        </div>
        <div style={{ position: 'sticky', bottom: 0, zIndex: 2, flexShrink: 0, borderTop: '1px solid var(--bd)', padding: '10px max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left))', display: 'flex', gap: 8, background: 'var(--bg1)' }}>
          <button type="button" className="btn primary sm" onClick={onEdit} data-testid="person-edit" style={{ flex: 1, minHeight: 44 }}>{t('pp_edit')}</button>
          {moreButton}
          {menuPanel('bottom')}
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="person-page"
      style={{ flex: '0 0 min(860px, 64vw)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 240px', minHeight: 0, minWidth: 0, background: 'var(--bg1)' }}
    >
      <div style={{ overflowY: 'auto', padding: '16px 20px', minWidth: 0 }}>
        {header}
        {main}
      </div>
      <aside style={{ overflowY: 'auto', padding: '16px 16px', borderLeft: '1px solid var(--bd)', minWidth: 0 }}>
        <div style={{ ...LABEL, marginBottom: 8 }}>{t('pp_contact')}</div>
        {detailRows}
      </aside>
    </div>
  )
}
