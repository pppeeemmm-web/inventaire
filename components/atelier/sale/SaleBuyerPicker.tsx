'use client'

// Phone sale, buyer step (stress test 2026-11-18: one long select, no search, no « + nouveau contact »).
// Search with tall rows, then « + Nouveau contact » that creates through the contact door (saveContact) and picks
// the new contact. Same search, copy and « same email / same name » warning as the desk sale form (NewOrderForm).

import { useId, useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { compareContactsByName, contactListLabel, contactSearchText } from '@/lib/contacts/contact-display'
import { saveContact } from '@/app/atelier/(portal)/contacts/save-contact'
import { saveContactRefusalText } from '@/lib/contacts/save-contact-message'
import { confirmIfSimilarContact } from '@/lib/contacts/similar-contact-warning'
import type { DictKey } from '@/lib/i18n/dictionary'
import type { MobileSaleContact } from '@/components/atelier/sale/SaleNewClient'

const MAX_ROWS = 8
const NEW_FIELDS = [
  ['prenom', 'ord_newc_first', 'text', 'given-name'],
  ['nom', 'ord_newc_last', 'text', 'family-name'],
  ['institution', 'ord_newc_inst', 'text', 'organization'],
  ['email', 'ord_newc_email', 'email', 'email'],
  ['phone', 'ord_newc_phone', 'tel', 'tel'],
] as const

type NewKey = (typeof NEW_FIELDS)[number][0]

function hasName(c: MobileSaleContact): boolean {
  return !!(c.Nom?.trim() || c.Prénom?.trim() || c.NomInstitution?.trim())
}

export function SaleBuyerPicker({
  contacts,
  buyer,
  onPick,
}: {
  contacts: MobileSaleContact[]
  buyer: MobileSaleContact | null
  onPick: (contact: MobileSaleContact | null) => void
}) {
  const { t, lang } = useI18n()
  const uid = useId()
  const [query, setQuery] = useState('')
  const [newC, setNewC] = useState<Partial<Record<NewKey, string>> | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // A contact with no name at all (« #1002 ») cannot be told apart: not offered.
  const named = useMemo(() => contacts.filter(hasName).sort(compareContactsByName(lang)), [contacts, lang])
  const hits = useMemo(() => {
    const term = query.trim().toLowerCase()
    return (term ? named.filter((c) => contactSearchText(c).includes(term)) : named).slice(0, MAX_ROWS)
  }, [named, query])

  function openNew() {
    // What was typed becomes the name (« Prénom Nom »).
    const words = query.trim().split(/\s+/).filter(Boolean)
    setErr(null)
    setNewC(words.length > 1 ? { prenom: words[0], nom: words.slice(1).join(' ') } : { nom: words[0] ?? '' })
  }

  async function create() {
    if (!newC) return
    const v = (k: NewKey) => newC[k]?.trim() ?? ''
    if (!v('prenom') && !v('nom') && !v('institution')) { setErr(t('ord_newc_err_name')); return }
    setBusy(true); setErr(null)
    try {
      // Same email or name as a card already there: warn first (not a refusal), as on every other create.
      const go = await confirmIfSimilarContact(
        { nom: v('nom') || null, prenom: v('prenom') || null, institution: v('institution') || null, email: v('email') || null },
        t,
      )
      if (!go) return
      const res = await saveContact({
        id: null,
        fields: { Prénom: v('prenom') || null, Nom: v('nom') || null, NomInstitution: v('institution') || null },
        lists: {
          emails: v('email') ? [{ email: v('email'), label: 'Personnel', is_primary: true }] : [],
          phones: v('phone') ? [{ phone: v('phone'), label: 'Mobile', is_primary: true }] : [],
        },
      })
      const refusal = saveContactRefusalText(res, t)
      if (refusal || !('card' in res) || !res.card) { setErr(refusal ?? t('sale_mobile_buyer_new_failed')); return }
      const c = res.card.contact
      onPick({ ContactID: c.ContactID, Nom: c.Nom ?? null, Prénom: c.Prénom ?? null, NomInstitution: c.NomInstitution ?? null, Ville: c.Ville ?? null, Pays: c.Pays ?? null })
      setNewC(null); setQuery('')
    } finally {
      setBusy(false)
    }
  }

  if (buyer) {
    return (
      <div data-testid="mobile-sale-buyer-picked" style={pickedStyle}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong style={nameStyle}>{contactListLabel(buyer)}</strong>
          {buyer.Ville ? <span style={citySubStyle}>{buyer.Ville}</span> : null}
        </span>
        <button type="button" className="btn ghost sm" style={{ minHeight: 44, flex: 'none' }} onClick={() => onPick(null)} data-testid="mobile-sale-buyer-change">
          {t('ord_new_party_change')}
        </button>
      </div>
    )
  }

  const searchId = `${uid}-search`
  return (
    <div data-testid="mobile-sale-buyer">
      <label htmlFor={searchId} style={labelStyle}>{t('sale_mobile_buyer_search_label')}</label>
      <input
        id={searchId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('sale_mobile_buyer_search_ph')}
        autoComplete="off"
        enterKeyHint="search"
        style={inputStyle}
        data-testid="mobile-sale-buyer-search"
      />
      <div role="list" style={{ marginTop: 8, borderTop: '1px solid var(--bd)' }}>
        {hits.map((c) => (
          <div role="listitem" key={c.ContactID}>
            <button type="button" onClick={() => onPick(c)} style={rowStyle} data-testid="mobile-sale-buyer-row">
              <span style={nameStyle}>{contactListLabel(c)}</span>
              {c.Ville ? <span style={cityStyle}>{c.Ville}</span> : null}
            </button>
          </div>
        ))}
        {hits.length === 0 && query.trim() ? (
          <div role="listitem" style={{ ...rowStyle, cursor: 'default', color: 'var(--tx3)' }}>{t('sale_mobile_buyer_none')}</div>
        ) : null}
        {!newC ? (
          <div role="listitem">
            <button type="button" onClick={openNew} style={{ ...rowStyle, color: 'var(--ac)', fontWeight: 600 }} data-testid="mobile-sale-buyer-new">
              {t('ord_newc_open')}
            </button>
          </div>
        ) : null}
      </div>

      {newC ? (
        <div data-testid="mobile-sale-buyer-new-form" style={newFormStyle}>
          <div className="t-label">{t('ord_newc_title')}</div>
          {NEW_FIELDS.map(([k, label, type, auto]) => (
            <div key={k} style={{ display: 'grid', gap: 4 }}>
              <label htmlFor={`${uid}-${k}`} style={labelStyle}>{t(label as DictKey)}</label>
              <input
                id={`${uid}-${k}`}
                type={type}
                value={newC[k] ?? ''}
                autoComplete={auto}
                inputMode={type === 'email' ? 'email' : type === 'tel' ? 'tel' : undefined}
                onChange={(e) => setNewC((cur) => ({ ...(cur ?? {}), [k]: e.target.value }))}
                style={inputStyle}
              />
            </div>
          ))}
          {err ? <div role="alert" style={errStyle}>{err}</div> : null}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => { setNewC(null); setErr(null) }} style={{ minHeight: 48 }}>
              {t('ord_new_cancel')}
            </button>
            <button type="button" className="btn primary" disabled={busy} onClick={() => { void create() }} style={{ minHeight: 48 }} data-testid="mobile-sale-buyer-new-save">
              {busy ? t('ord_newc_saving') : t('ord_newc_save')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'var(--tx3)',
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 46,
  padding: '10px 12px',
  background: 'var(--bg0)',
  color: 'var(--tx)',
  border: '1px solid var(--bd)',
  boxSizing: 'border-box',
  font: 'inherit',
  fontSize: 16, // ≥ 16 px: iOS does not zoom on focus
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  minHeight: 48,
  padding: '6px 4px',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid var(--bd)',
  color: 'var(--tx)',
  textAlign: 'left',
  font: 'inherit',
  fontSize: 15,
  cursor: 'pointer',
  boxSizing: 'border-box',
}

const nameStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  display: 'block',
}

const cityStyle: React.CSSProperties = { flex: 'none', maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--tx3)', fontSize: 12 }
const citySubStyle: React.CSSProperties = { display: 'block', color: 'var(--tx3)', fontSize: 12, marginTop: 2 }

const pickedStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 60,
  padding: 10,
  border: '1px solid var(--ac)',
  boxSizing: 'border-box',
  fontSize: 15,
}

const newFormStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  border: '1px solid var(--bd2, var(--bd))',
  display: 'grid',
  gap: 10,
}

const errStyle: React.CSSProperties = {
  padding: 10,
  border: '1px solid var(--rust)',
  color: 'var(--rust)',
  fontSize: 13,
}
