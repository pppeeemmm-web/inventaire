'use client'

// Work card R3 top block (docs/design/2026-11-16/WorkCard.notes.md): the 3 production stages as
// coloured buttons with dates (tap = move there; Catalogué carries « photo requise / photo ✓ »),
// ownership as cyan chips incl. « Don… », owner / custodian as links ↗ (contact card over the work),
// the custodian's address. Contact confidentiality lives in Objet (`ContactConfidentialityPart`).

import type { Dispatch, SetStateAction } from 'react'
import { useMemo } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { PROD_STAGE_COLOR, type OwnStageId, type ProdStageId } from '@/lib/work-editor-model'
import type { DrawerContactRow } from './drawer-content-props'
import type { ContactAddress } from '@/components/atelier/contact-editor-types'
import { LocationAddressPicker } from '@/components/atelier/LocationAddressPicker'
import { PEM_CONTACT_ID } from '@/lib/data'
import { FIS } from './drawer-widgets'
import { Chip, TopLabel, chipH } from './WorkCardParts'

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
  /** « Don… » chip → GiftTransferModal (keeps the gift override). */
  onGift: () => void
  /** Production span, already formatted (« 12 juin 2025 »), or ''. */
  startedLabel: string
  completedLabel: string
  /** Destroyed / lost: stages locked until the constat is closed (DB guard too). */
  locked: boolean
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
  startedLabel,
  completedLabel,
  locked,
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
  const lockedByOrder = BY_ORDER.includes(loadedOwnStage)
  const stageDisabled = (id: OwnStageId) => {
    if (locked) return id !== ownStage
    if (id === loadedOwnStage) return false
    if (lockedByOrder) return true
    return BY_ORDER.includes(id) || id === 'gift'
  }
  const isGift = ownStage === 'gift'
  const prodLocked = locked || isOwnershipTransferred || isArchived
  const pemName = pemContact?.NomInstitution ?? 'Pem'
  /** Pem is not always in the drawer's contact list; name it from the id. */
  const isPem = (id: string) => id === String(PEM_CONTACT_ID) || (!!pemContact && id === String(pemContact.ContactID))
  const nameOf = (id: string) => {
    if (isPem(id)) return pemName
    const c = sortedContacts.find((x) => String(x.ContactID) === id)
    return c ? cName(c) : '—'
  }
  const rowH = narrow ? 44 : 32
  const prodIdx = PRODUCTION_STAGES.findIndex((s) => s.id === prodStage)

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

  const kvGrid = { display: 'grid', gridTemplateColumns: '96px minmax(0,1fr)', gap: '4px 12px', alignItems: 'center' } as const

  return (
    <div data-testid="work-drawer-status-bar" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div>
        <TopLabel>{t('wc_prod_label')}</TopLabel>
        <div style={{ display: 'flex', marginTop: 5, minWidth: 0 }}>
          {PRODUCTION_STAGES.map((s, i) => {
            const on = s.id === prodStage
            const done = i < prodIdx
            const col = PROD_STAGE_COLOR[s.id]
            // Archive works stop at Catalogué (DB rule); sold / given works keep their last stage.
            const closed = prodLocked && !on
            const small =
              s.id === 'atelier'
                ? startedLabel ? t('wc_stage_started_fmt').replace('{date}', startedLabel) : ''
                : s.id === 'catalogued'
                  ? [completedLabel, prodStage === 'catalogued' && needsPhoto ? t('wc_stage_photo_needed') : prodIdx >= 1 ? t('wc_stage_photo_ok') : '']
                      .filter(Boolean)
                      .join(' · ')
                  : ''
            return (
              <button
                key={s.id}
                type="button"
                data-testid={`work-drawer-stage-${s.id}`}
                aria-pressed={on}
                disabled={closed}
                title={closed ? t('wc_stage_locked_tt') : on ? s.desc : `${s.desc} — ${t('wc_stage_next_tt')}`}
                onClick={() => {
                  if (prodLocked) return
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
                }}
              >
                <span style={{ fontWeight: on ? 700 : 500 }}>{done ? '✓ ' : ''}{s.label}</span>
                {small ? (
                  <span
                    title={s.id === 'catalogued' && needsPhoto && on ? t('wc_stage_photo_needed_tt') : undefined}
                    style={{ display: 'block', fontSize: 10, color: 'var(--tx3)', marginTop: 1, overflowWrap: 'anywhere' }}
                  >
                    {small}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <TopLabel title={lockedByOrder ? t('custody_by_order_hint') : isGift ? t('custody_gift_override_hint') : undefined}>
          {t('wc_own_label')}
          {lockedByOrder || isGift ? <span style={{ fontWeight: 400 }}> ⓘ</span> : null}
        </TopLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 5, alignItems: 'center', minHeight: narrow ? 44 : undefined }}>
          {OWNERSHIP_STAGES.map((s) => {
            const dis = stageDisabled(s.id)
            return (
              <Chip
                key={s.id}
                narrow={narrow}
                tone="own"
                active={s.id === ownStage}
                disabled={dis && s.id !== ownStage}
                title={dis && s.id !== ownStage ? `${s.desc} — ${lockedByOrder ? t('custody_by_order_hint') : t('custody_gift_override_hint')}` : s.desc}
                testId={`work-drawer-own-${s.id}`}
                onClick={() => { if (!dis) setOwnStage(s.id) }}
              >
                {s.label}
              </Chip>
            )
          })}
          {!(ownStage === 'sold' || ownStage === 'gift' || ownStage === 'artist_archive') && !locked ? (
            <Chip narrow={narrow} tone="own" dashed onClick={onGift} title={t('wc_gift_chip_tt')} testId="work-drawer-gift">
              {t('wc_gift_chip')}
            </Chip>
          ) : null}
        </div>
      </div>

      <div style={kvGrid}>
        <TopLabel>{ownStage === 'reserved' ? t('custody_buyer') : t('custody_owner')}</TopLabel>
        <div style={{ minWidth: 0 }}>
          {ownStage === 'reserved'
            ? contactSelect(buyerId, setBuyerId, t('custody_buyer'))
            : isGift
              ? contactSelect(ownerId, setOwnerId, t('custody_owner'))
              : contactLink(ownerId, ownStage === 'artist' || ownStage === 'artist_archive' ? pemName : nameOf(ownerId))}
          {ownStage === 'reserved' ? (
            <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('custody_owner')} : {pemName}</div>
          ) : null}
        </div>
        <TopLabel>{t('custody_custodian')}</TopLabel>
        <div style={{ minWidth: 0 }}>
          {isGift
            ? contactSelect(contactId, setContactId, t('custody_custodian'))
            : (
                <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  {contactLink(contactId, isPem(contactId) ? pemName : currentLoc)}
                  {isArchived ? <span style={{ fontSize: 11, color: 'var(--tx3)' }}>· {t('wc_custodian_auto')}</span> : null}
                </span>
              )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, minHeight: chipH(narrow), minWidth: 0 }}>
            <span style={{ fontSize: 10, color: 'var(--tx3)', flexShrink: 0 }}>{t('custody_address')}</span>
            <LocationAddressPicker addresses={locationAddresses} value={localisationAddressId} onChange={setLocalisationAddressId} />
          </div>
        </div>
      </div>
    </div>
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
