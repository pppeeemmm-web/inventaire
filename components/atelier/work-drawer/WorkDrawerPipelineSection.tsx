'use client'

// Work card R3 top block (docs/design/2026-11-16/WorkCard.notes.md): the 3 production stages as
// coloured buttons with dates (tap = move there; Catalogué carries « photo requise / photo ✓ »),
// ownership as cyan chips incl. « Don… », owner / custodian as links ↗ (contact card over the work),
// the custodian's address. Contact confidentiality lives in Objet (`ContactConfidentialityPart`).

import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '@/lib/i18n/context'
import { PROD_STAGE_COLOR, type OwnStageId, type ProdStageId } from '@/lib/work-editor-model'
import type { DrawerContactRow } from './drawer-content-props'
import type { ContactAddress } from '@/components/atelier/contact-editor-types'
import { LocationAddressPicker } from '@/components/atelier/LocationAddressPicker'
import { PEM_CONTACT_ID } from '@/lib/data'
import { FIS } from './drawer-widgets'
import { Chip, TopLabel, chipH } from './WorkCardParts'
import { WithCaption } from './WorkCardCaption'

export type WorkDrawerPipelineSectionProps = {
  /** Open a contact's card from the drawer (Kaizen #34: bounce work → contact → work). */
  onOpenContact?: (contactId: number) => void
  narrow: boolean
  prodStage: ProdStageId
  setProdStage: (next: ProdStageId) => void
  needsPhoto: boolean
  setNeedsPhoto: (v: boolean) => void
  ownStage: OwnStageId
  setOwnStage: Dispatch<SetStateAction<OwnStageId>>
  isOwnershipTransferred: boolean
  isArchived: boolean
  pemContact: DrawerContactRow | undefined
  /** Custodian (LocalisationID). */
  contactId: string
  setContactId: Dispatch<SetStateAction<string>>
  ownerId: string
  setOwnerId: Dispatch<SetStateAction<string>>
  buyerId: string
  setBuyerId: Dispatch<SetStateAction<string>>
  /** Stage as saved — consignment / loan / sale stages move only through their order. */
  loadedOwnStage: OwnStageId
  locationAddresses: ContactAddress[]
  localisationAddressId: string
  setLocalisationAddressId: Dispatch<SetStateAction<string>>
  sortedContacts: DrawerContactRow[]
  cName: (c: DrawerContactRow) => string
  currentLoc: string
  setShowNewContact: Dispatch<SetStateAction<boolean>>
  /** « Don… » chip → GiftTransferModal on a gift order. */
  onGift: () => void
  /** « Dépôt… / Prêt… / Vendu… » chips → the same form on that kind (a draft order, R7). */
  onOrder?: (kind: 'consignment' | 'loan' | 'sale') => void
  /** The order the work is on: the stage chip it set links to it. */
  orderLink?: { id: string; ref: string | null; kind?: string; status?: string; party?: string } | null
  /** Production span, already formatted (« 12 juin 2025 »), or ''. */
  startedLabel: string
  completedLabel: string
  /** Destroyed / lost: stages locked until the constat is closed (DB guard too). */
  locked: boolean
  /** Destroyed / lost line (« Détruite · 15 oct. 2026 »): shown in place of the stage row. */
  fateText?: string
  /** Admin may change an archive work's custodian (set to the artist automatically). */
  isAdmin?: boolean
}

export function WorkDrawerPipelineSection({
  narrow,
  prodStage,
  setProdStage,
  needsPhoto,
  setNeedsPhoto,
  ownStage,
  setOwnStage,
  isOwnershipTransferred,
  isArchived,
  pemContact,
  contactId,
  setContactId,
  ownerId,
  setOwnerId,
  buyerId,
  setBuyerId,
  loadedOwnStage,
  locationAddresses,
  localisationAddressId,
  setLocalisationAddressId,
  sortedContacts,
  cName,
  currentLoc,
  setShowNewContact,
  onOpenContact,
  onGift,
  onOrder,
  orderLink = null,
  startedLabel,
  completedLabel,
  locked,
  fateText,
  isAdmin = false,
}: WorkDrawerPipelineSectionProps) {
  const { t } = useI18n()

  const PRODUCTION_STAGES = useMemo(
    () => [
      { id: 'atelier' as const, label: t('wf_prod_atelier_l'), desc: t('wf_prod_atelier_d') },
      { id: 'catalogued' as const, label: t('wf_prod_cat_l'), desc: t('wf_prod_cat_d') },
      { id: 'available' as const, label: t('wf_prod_avail_l'), desc: t('wf_prod_avail_d') },
    ],
    [t],
  )
  const OWNERSHIP_STAGES = useMemo(
    () => [
      { id: 'artist' as const, label: t('wf_own_artist_l'), desc: t('wf_own_artist_d') },
      { id: 'reserved' as const, label: t('wf_own_reserved_l'), desc: t('wf_own_reserved_d') },
      { id: 'consigned' as const, label: t('wf_own_consigned_l'), desc: t('wf_own_consigned_d') },
      { id: 'loan' as const, label: t('wf_own_loan_l'), desc: t('wf_own_loan_d') },
      { id: 'sold' as const, label: t('wf_own_sold_l'), desc: t('wf_own_sold_d') },
      { id: 'gift' as const, label: t('wf_own_gift_l'), desc: t('wf_own_gift_d') },
      { id: 'artist_archive' as const, label: t('wf_own_archive_l'), desc: t('wf_own_archive_d') },
    ],
    [t],
  )

  // docs/WORK_CUSTODY_MODEL.md: a work leaves Pem only through an order (consignment, loan,
  // sale), so those stages are never picked here; a gift is the owner's call (« Don… »), and
  // once given the recipient and the custodian stay editable.
  const BY_ORDER: OwnStageId[] = ['consigned', 'loan', 'sold']
  const ORDER_KIND: Partial<Record<OwnStageId, 'consignment' | 'loan' | 'sale'>> = { consigned: 'consignment', loan: 'loan', sold: 'sale' }
  const lockedByOrder = BY_ORDER.includes(loadedOwnStage)
  /** Archive = catalogued first (Pem 2026-11-17, archive_shelf.sql). */
  const archiveNeedsCatalogue = prodStage === 'atelier'
  // R7 v2: from the card, a work in Pem's hands can start any order (as a draft to check).
  const canStartOrder = !!onOrder && !locked && !lockedByOrder && loadedOwnStage === 'artist' && !isArchived
  const stageDisabled = (id: OwnStageId) => {
    if (locked) return id !== ownStage
    if (id === 'artist_archive' && archiveNeedsCatalogue) return true
    if (id === loadedOwnStage) return false
    if (lockedByOrder) return true
    return BY_ORDER.includes(id) || id === 'gift'
  }
  const isGift = ownStage === 'gift'
  /**
   * R3 rules (WorkCard.notes « Rules the build must enforce »): an archive work is catalogued (DB
   * trigger) and never Disponible — a validated photo shows as « Catalogué · photo ✓ »; a sold or
   * given work has left the atelier. Each closed stage says why.
   */
  const stageWhy = (id: ProdStageId): string => {
    if (locked) return t('wr_stage_fate_tt')
    if (isArchived) return id === 'atelier' ? t('wr_stage_archive_atelier_tt') : id === 'available' ? t('wr_stage_archive_avail_tt') : ''
    if (isOwnershipTransferred && id === 'atelier') return t('wr_stage_transferred_atelier_tt')
    return ''
  }
  const shownStage: ProdStageId = isArchived && prodStage === 'available' ? 'catalogued' : prodStage
  const pemName = pemContact?.NomInstitution ?? 'Pem'
  /** Pem is not always in the drawer's contact list; name it from the id. */
  const isPem = (id: string) => id === String(PEM_CONTACT_ID) || (!!pemContact && id === String(pemContact.ContactID))
  const nameOf = (id: string) => {
    if (isPem(id)) return pemName
    const c = sortedContacts.find((x) => String(x.ContactID) === id)
    return c ? cName(c) : '—'
  }
  const rowH = narrow ? 44 : 32
  const prodIdx = PRODUCTION_STAGES.findIndex((s) => s.id === shownStage)

  /** Name as a link ↗ → contact card over the work (the work stays open). */
  const contactLink = (id: string, name: string) => {
    const n = Number.parseInt(id, 10)
    if (!onOpenContact || !Number.isFinite(n) || n <= 0) return <span style={{ fontSize: 13 }}>{name}</span>
    return (
      <button
        type="button"
        data-testid="work-drawer-open-contact"
        title={t('wf_open_contact')}
        onClick={() => onOpenContact(n)}
        style={{ background: 'none', border: 'none', padding: 0, minHeight: narrow ? 44 : undefined, color: 'var(--tx)', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', textAlign: 'left', overflowWrap: 'anywhere' }}
      >
        <span style={{ borderBottom: '1px solid var(--bd3)' }}>{name}</span>
        <span style={{ color: 'var(--tx3)', fontSize: 11, marginLeft: 4 }}>↗</span>
      </button>
    )
  }

  const contactSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 0 }}>
      <select
        className="input"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...FIS, flex: 1, minWidth: 0, height: rowH, padding: '0 8px' }}
      >
        <option value="">{t('select_option_placeholder')}</option>
        {!sortedContacts.some((c) => isPem(String(c.ContactID))) && (
          <option value={String(PEM_CONTACT_ID)}>{pemName}</option>
        )}
        {sortedContacts.map((c) => (
          <option key={c.ContactID} value={c.ContactID}>{cName(c)}</option>
        ))}
      </select>
      {value ? contactLink(value, '') : null}
      <button
        type="button"
        className="btn ghost sm"
        aria-label={t('wf_new_contact')}
        title={t('wf_new_contact')}
        style={{ flexShrink: 0, width: rowH, minWidth: rowH, height: rowH, padding: 0 }}
        onClick={() => setShowNewContact(true)}
      >
        +
      </button>
    </div>
  )

  const chosenAddress = locationAddresses.find((a) => String(a.id) === localisationAddressId) ?? (locationAddresses.length === 1 ? locationAddresses[0] : undefined)
  const addressText = chosenAddress ? [chosenAddress.label, chosenAddress.ville].filter(Boolean).join(' — ') : ''
  const kvGrid = { display: 'grid', gridTemplateColumns: '96px minmax(0,1fr)', gap: '4px 12px', alignItems: 'center' } as const

  return (
    <div data-testid="work-drawer-status-bar" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div>
        <TopLabel title={t('wc_prod_label_tt')}>{t('wc_prod_label')}</TopLabel>
        {locked && fateText ? (
          // A destroyed / lost work has no production stage: the lit « En production » read as live.
          <div
            data-testid="work-drawer-stage-fate"
            style={{
              marginTop: 5,
              minHeight: narrow ? 44 : 36,
              padding: '6px 10px',
              border: '1px solid var(--yellow)',
              background: 'color-mix(in srgb, var(--yellow) 14%, transparent)',
              fontSize: 12,
              lineHeight: 1.3,
              minWidth: 0,
            }}
          >
            <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{fateText}</div>
            <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>{t('fate_locked')}</div>
          </div>
        ) : (
        <div style={{ display: 'flex', marginTop: 5, minWidth: 0 }}>
          {PRODUCTION_STAGES.map((s, i) => {
            const on = s.id === shownStage
            const done = i < prodIdx
            const col = PROD_STAGE_COLOR[s.id]
            const why = on ? '' : stageWhy(s.id)
            const closed = !!why
            const small =
              s.id === 'atelier'
                ? startedLabel ? t('wc_stage_started_fmt').replace('{date}', startedLabel) : ''
                : s.id === 'catalogued'
                  ? [completedLabel, prodIdx >= 1 ? (needsPhoto ? t('wc_stage_photo_needed') : t('wc_stage_photo_ok')) : '']
                      .filter(Boolean)
                      .join(' · ')
                  : ''
            const caption = [
              closed ? `${s.desc} — ${why}` : on ? s.desc : `${s.desc} — ${t('wc_stage_next_tt')}`,
              s.id === 'catalogued' && on && needsPhoto ? t('wc_stage_photo_needed_tt') : '',
            ].filter(Boolean).join(' ')
            return (
              <WithCaption key={s.id} text={caption}>{(cap) => (
              <button
                type="button"
                data-testid={`work-drawer-stage-${s.id}`}
                aria-pressed={on}
                aria-disabled={closed}
                {...cap}
                onClick={() => {
                  if (closed || locked) return
                  if (on && s.id === 'catalogued' && needsPhoto) {
                    // « photo requise » → picture done = Disponible (same as unticking « Photo requise »).
                    setNeedsPhoto(false)
                    return
                  }
                  if (!on) setProdStage(s.id)
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: narrow ? 44 : 36,
                  padding: '4px 8px',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  lineHeight: 1.2,
                  border: `1px ${closed ? 'dashed' : 'solid'} ${on ? col : 'var(--bd2)'}`,
                  marginLeft: i === 0 ? 0 : -1,
                  background: on ? `color-mix(in srgb, ${col} 18%, transparent)` : 'transparent',
                  color: closed ? 'var(--mt)' : on || done ? col : 'var(--tx3)',
                  cursor: closed ? 'not-allowed' : 'pointer',
                  position: 'relative',
                  zIndex: on ? 1 : 0,
                  WebkitTouchCallout: 'none',
                }}
              >
                <span style={{ fontWeight: on ? 700 : 500 }}>{done ? '✓ ' : ''}{s.label}</span>
                {small ? (
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--tx3)', marginTop: 1, overflowWrap: 'anywhere' }}>
                    {small}
                  </span>
                ) : null}
              </button>
              )}</WithCaption>
            )
          })}
        </div>
        )}
      </div>

      <div>
        <TopLabel title={[t('wc_own_label_tt'), lockedByOrder ? t('custody_by_order_hint') : isGift ? t('custody_gift_override_hint') : ''].filter(Boolean).join(' ')}>
          {t('wc_own_label')}
        </TopLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 5, alignItems: 'center', minHeight: narrow ? 44 : undefined }}>
          {OWNERSHIP_STAGES.map((s) => {
            const isOn = s.id === ownStage
            // One control for the gift (mockup): « Don » when given, otherwise the « Don… » action.
            if (s.id === 'gift' && !isOn) {
              const canGift = !locked && !lockedByOrder && ownStage !== 'artist_archive'
              return (
                <Chip
                  key={s.id}
                  narrow={narrow}
                  tone="own"
                  dashed
                  disabled={!canGift}
                  onClick={canGift ? onGift : undefined}
                  title={canGift ? t('wc_gift_chip_tt') : `${t('wc_gift_chip_tt')} — ${locked ? t('wc_own_closed_locked_tt') : lockedByOrder ? t('wc_own_closed_order_tt') : t('wf_own_archive_d')}`}
                  testId="work-drawer-gift"
                >
                  {t('wc_gift_chip')}
                </Chip>
              )
            }
            // The stage an order set: a link to that order (« Confié » keeps the stage: its own chip below).
            if (isOn && orderLink && orderLink.kind !== 'entrusted' && (BY_ORDER.includes(s.id) || s.id === 'gift' || s.id === 'reserved')) {
              return (
                <Chip
                  key={s.id}
                  narrow={narrow}
                  tone="own"
                  active
                  onClick={() => window.location.assign(`/atelier/sales?order=${orderLink.id}`)}
                  title={`${s.desc} — ${t('wc_order_link_tt').replace('{ref}', orderLink.ref ?? '')}`}
                  testId={`work-drawer-own-${s.id}`}
                >
                  {`${s.label} · ${orderLink.ref ?? ''}`}
                </Chip>
              )
            }
            // Dépôt… / Prêt… / Vendu…: a draft order for this work (like « Don… »).
            const orderKind = ORDER_KIND[s.id]
            if (!isOn && orderKind && canStartOrder) {
              return (
                <Chip
                  key={s.id}
                  narrow={narrow}
                  tone="own"
                  dashed
                  onClick={() => onOrder?.(orderKind)}
                  title={`${s.desc} — ${t('wc_order_chip_tt')}`}
                  testId={`work-drawer-own-${s.id}`}
                >
                  {`${s.label}…`}
                </Chip>
              )
            }
            const dis = stageDisabled(s.id) && !isOn
            const why = !dis
              ? ''
              : locked
                ? t('wc_own_closed_locked_tt')
                : s.id === 'artist_archive' && archiveNeedsCatalogue
                  ? t('wc_own_closed_archive_tt')
                  : lockedByOrder || BY_ORDER.includes(s.id)
                  ? t('wc_own_closed_order_tt')
                  : t('wc_own_closed_gift_tt')
            return (
              <Chip
                key={s.id}
                narrow={narrow}
                tone="own"
                active={isOn}
                disabled={dis}
                title={why ? `${s.desc} — ${why}` : s.desc}
                testId={`work-drawer-own-${s.id}`}
                onClick={() => { if (!dis) setOwnStage(s.id) }}
              >
                {s.label}
              </Chip>
            )
          })}
          {/* « Confié » (R7): the work keeps its stage and is with a craftsperson until it comes back. */}
          {orderLink?.kind === 'entrusted' && orderLink.status === 'out' && (
            <Chip
              narrow={narrow}
              tone="own"
              active
              onClick={() => window.location.assign(`/atelier/sales?order=${orderLink.id}`)}
              title={t('wc_entrusted_chip_tt').replace('{ref}', orderLink.ref ?? '')}
              testId="work-drawer-entrusted"
            >
              {t('wc_entrusted_chip').replace('{party}', orderLink.party ?? '')}
            </Chip>
          )}
        </div>
      </div>

      <div style={kvGrid}>
        <TopLabel>{ownStage === 'reserved' ? t('custody_buyer') : t('custody_owner')}</TopLabel>
        <div style={{ minWidth: 0 }}>
          {ownStage === 'reserved'
            ? (
                <ContactWho
                  id={buyerId}
                  name={nameOf(buyerId)}
                  narrow={narrow}
                  onOpen={onOpenContact}
                  select={contactSelect(buyerId, setBuyerId, t('custody_buyer'))}
                  canChange
                  testId="work-card-buyer"
                />
              )
            : (
                <ContactWho
                  id={ownerId}
                  name={ownStage === 'artist' || ownStage === 'artist_archive' ? pemName : nameOf(ownerId)}
                  narrow={narrow}
                  onOpen={onOpenContact}
                  select={isGift ? contactSelect(ownerId, setOwnerId, t('custody_owner')) : null}
                  canChange={isGift}
                  testId="work-card-owner"
                />
              )}
          {ownStage === 'reserved' ? (
            <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('custody_owner')} : {pemName}</div>
          ) : null}
        </div>
        <TopLabel>{t('custody_custodian')}</TopLabel>
        <div style={{ minWidth: 0 }}>
          <ContactWho
            id={contactId}
            name={isPem(contactId) ? pemName : isGift ? nameOf(contactId) : currentLoc}
            narrow={narrow}
            onOpen={onOpenContact}
            select={isGift || (isArchived && isAdmin) ? contactSelect(contactId, setContactId, t('custody_custodian')) : null}
            canChange={isGift || (isArchived && isAdmin)}
            address={addressText}
            addressPicker={
              locationAddresses.length > 1 ? (
                <LocationAddressPicker addresses={locationAddresses} value={localisationAddressId} onChange={setLocalisationAddressId} />
              ) : null
            }
            note={isArchived ? (isAdmin ? t('wr_custodian_archive_admin') : t('wr_custodian_archive')) : ''}
            testId="work-card-custodian"
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Owner / custodian name as a link ↗ with its hover card (mockup: address, « Fiche ↗ », « Changer… »,
 * « Adresse ▾ »). Desktop: hover shows the card, a click opens the contact card. Touch: a tap shows the
 * card. « Changer… » / « Adresse ▾ » swap the name for the select in place (no inputs in the card).
 */
function ContactWho({
  id,
  name,
  narrow,
  onOpen,
  select,
  canChange,
  address,
  addressPicker,
  note,
  testId,
}: {
  id: string
  name: string
  narrow: boolean
  onOpen?: (contactId: number) => void
  /** The select to show for « Changer… » (null = not changeable here). */
  select: ReactNode
  canChange: boolean
  address?: string
  addressPicker?: ReactNode
  note?: string
  testId?: string
}) {
  const { t } = useI18n()
  const n = Number.parseInt(id, 10)
  const known = Number.isFinite(n) && n > 0
  const [editing, setEditing] = useState(!known && !!select)
  const [pickAddr, setPickAddr] = useState(false)
  const [card, setCard] = useState<{ left: number; top: number } | null>(null)
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  const showT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPointer = useRef<string>('mouse')
  const clearT = () => {
    if (showT.current) clearTimeout(showT.current)
    if (hideT.current) clearTimeout(hideT.current)
  }
  const open = () => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const w = Math.min(240, window.innerWidth - 16)
    setCard({ left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), top: r.bottom + 4 })
  }
  const close = () => setCard(null)
  useEffect(() => {
    if (!card) return
    const off = (e: Event) => {
      const tgt = e.target as Node | null
      if (tgt && (anchorRef.current?.contains(tgt) || document.getElementById('wc-contact-hovercard')?.contains(tgt))) return
      close()
    }
    window.addEventListener('pointerdown', off, true)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('pointerdown', off, true)
      window.removeEventListener('scroll', close, true)
    }
  }, [card])
  useEffect(() => clearT, [])

  if (editing && select) {
    return (
      <div data-testid={testId} style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>{select}</div>
        {known ? (
          <button type="button" className="btn ghost sm" onClick={() => setEditing(false)} style={{ minHeight: narrow ? 44 : 28, padding: '0 8px' }}>
            {t('wc_done')}
          </button>
        ) : null}
      </div>
    )
  }

  const btn = { height: narrow ? 36 : 24, padding: '0 7px', fontSize: 11 } as const
  const cardNode =
    card && typeof document !== 'undefined'
      ? createPortal(
          <div
            id="wc-contact-hovercard"
            data-testid="work-card-hovercard"
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') clearT() }}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') hideT.current = setTimeout(close, 200) }}
            style={{
              position: 'fixed',
              left: card.left,
              top: card.top,
              width: 'max-content',
              maxWidth: 'min(240px, calc(100vw - 16px))',
              zIndex: 10040,
              background: 'var(--bg2)',
              border: '1px solid var(--bd3)',
              borderRadius: 4,
              padding: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,.5)',
              fontSize: 12,
              color: 'var(--tx2)',
            }}
          >
            <div style={{ color: 'var(--tx)', fontSize: 13, fontWeight: 600, overflowWrap: 'anywhere' }}>{name || '—'}</div>
            {address !== undefined ? (
              <div style={{ marginTop: 2, color: address ? 'var(--tx2)' : 'var(--mt)', overflowWrap: 'anywhere' }}>{address || t('wc_hc_no_address')}</div>
            ) : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {known && onOpen ? (
                <button type="button" className="btn ghost sm" data-testid="work-card-hc-open" style={btn} onClick={() => { close(); onOpen(n) }}>
                  {t('wc_hc_card')}
                </button>
              ) : null}
              <button
                type="button"
                className="btn ghost sm"
                data-testid="work-card-hc-change"
                aria-disabled={!canChange}
                title={canChange ? undefined : t('wc_hc_change_locked_tt')}
                style={{ ...btn, opacity: canChange ? 1 : 0.45, cursor: canChange ? 'pointer' : 'not-allowed' }}
                onClick={() => { if (!canChange) return; close(); setEditing(true) }}
              >
                {t('wc_hc_change')}
              </button>
              {addressPicker ? (
                <button type="button" className="btn ghost sm" data-testid="work-card-hc-address" style={btn} onClick={() => { close(); setPickAddr((v) => !v) }}>
                  {t('wc_hc_address')}
                </button>
              ) : null}
            </div>
            {!canChange ? <div style={{ marginTop: 6, fontSize: 10, color: 'var(--tx3)' }}>{t('wc_hc_change_locked_tt')}</div> : null}
          </div>,
          document.body,
        )
      : null

  return (
    <div data-testid={testId} style={{ minWidth: 0 }}>
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, minWidth: 0 }}>
        <button
          ref={anchorRef}
          type="button"
          data-testid="work-drawer-open-contact"
          aria-haspopup="dialog"
          aria-expanded={!!card}
          onPointerDown={(e) => { lastPointer.current = e.pointerType }}
          onPointerEnter={(e) => {
            if (e.pointerType !== 'mouse') return
            clearT()
            showT.current = setTimeout(open, 300)
          }}
          onPointerLeave={(e) => {
            if (e.pointerType !== 'mouse') return
            clearT()
            hideT.current = setTimeout(close, 200)
          }}
          onClick={() => {
            if (lastPointer.current !== 'mouse') {
              if (card) close()
              else open()
              return
            }
            clearT()
            close()
            if (known && onOpen) onOpen(n)
          }}
          style={{ background: 'none', border: 'none', padding: 0, minHeight: narrow ? 44 : undefined, color: 'var(--tx)', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', textAlign: 'left', overflowWrap: 'anywhere', minWidth: 0 }}
        >
          <span style={{ borderBottom: '1px solid var(--bd3)' }}>{name || '—'}</span>
          <span style={{ color: 'var(--tx3)', fontSize: 11, marginLeft: 4 }}>↗</span>
        </button>
        {address ? <span style={{ fontSize: 11, color: 'var(--tx3)', overflowWrap: 'anywhere' }}>· {address}</span> : null}
        {note ? <span style={{ fontSize: 11, color: 'var(--tx3)' }}>· {note}</span> : null}
      </span>
      {pickAddr && addressPicker ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, minHeight: chipH(narrow), minWidth: 0 }}>{addressPicker}</div>
      ) : null}
      {cardNode}
    </div>
  )
}

/** Objet › Valeur « Commande » client: the work's buyer (AcheteurID), picked like the owner. */
export function CommissionClient({
  buyerId,
  setBuyerId,
  contacts,
  cName,
  narrow,
  onOpenContact,
}: {
  buyerId: string
  setBuyerId: Dispatch<SetStateAction<string>>
  contacts: DrawerContactRow[]
  cName: (c: DrawerContactRow) => string
  narrow: boolean
  onOpenContact: (contactId: number) => void
}) {
  const { t } = useI18n()
  const c = contacts.find((x) => String(x.ContactID) === buyerId)
  const select = (
    <select
      className="input"
      aria-label={t('wc_commission_client')}
      title={t('wc_commission_client_tt')}
      value={buyerId}
      onChange={(e) => setBuyerId(e.target.value)}
      style={{ ...FIS, minWidth: 0, maxWidth: 260, height: narrow ? 44 : 26, padding: '0 6px', fontSize: 12 }}
    >
      <option value="">{t('wc_commission_client')}</option>
      {contacts.map((x) => (
        <option key={x.ContactID} value={x.ContactID}>{cName(x)}</option>
      ))}
    </select>
  )
  return (
    <ContactWho
      id={buyerId}
      name={c ? cName(c) : ''}
      narrow={narrow}
      onOpen={onOpenContact}
      select={select}
      canChange
      testId="wc-commission-client"
    />
  )
}

/** Objet › Confidentialité du contact (`anonymity_level`) — never called « visibilité » (Pem v3). */
export function ContactConfidentialityPart({
  anonymityLevel,
  setAnonymityLevel,
  narrow,
}: {
  anonymityLevel: number
  setAnonymityLevel: Dispatch<SetStateAction<number>>
  narrow: boolean
}) {
  const { t } = useI18n()
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', minHeight: narrow ? 44 : undefined }}>
        {[
          { level: 0, label: t('wf_vis_public'), desc: t('wf_vis_public_d') },
          { level: 1, label: t('wf_vis_masked'), desc: t('wf_vis_masked_d') },
          { level: 2, label: t('wf_vis_private'), desc: t('wf_vis_private_d') },
        ].map(({ level, label, desc }) => (
          <Chip
            key={level}
            narrow={narrow}
            tone="ac"
            active={anonymityLevel === level}
            title={desc}
            testId={`work-drawer-anonymity-${level}`}
            onClick={() => setAnonymityLevel(level)}
          >
            {label}
          </Chip>
        ))}
      </div>
      {anonymityLevel === 2 ? (
        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--rust)' }}>{t('wf_vis_private_banner')}</div>
      ) : null}
    </div>
  )
}
