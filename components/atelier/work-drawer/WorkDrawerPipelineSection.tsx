'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useMemo } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { PROD_STAGE_COLOR, type OwnStageId, type ProdStageId } from '@/lib/work-editor-model'
import type { DrawerContactRow } from './drawer-content-props'
import type { ContactAddress } from '@/components/atelier/contact-editor-types'
import { LocationAddressPicker } from '@/components/atelier/LocationAddressPicker'
import { PEM_CONTACT_ID } from '@/lib/data'
import { SectionTitle, WfPipeProgress, WfSwitch, FIS } from './drawer-widgets'

export type WorkDrawerPipelineSectionProps = {
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
  anonymityLevel: number
  setAnonymityLevel: Dispatch<SetStateAction<number>>
  setShowNewContact: Dispatch<SetStateAction<boolean>>
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
  anonymityLevel,
  setAnonymityLevel,
  setShowNewContact,
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
  // sale), so those stages are never picked here; a gift is the owner's call (Gift dialog), and
  // once given the recipient and the custodian stay editable.
  const BY_ORDER: OwnStageId[] = ['consigned', 'loan', 'sold']
  const lockedByOrder = BY_ORDER.includes(loadedOwnStage)
  const stageDisabled = (id: OwnStageId) => {
    if (id === loadedOwnStage) return false
    if (lockedByOrder) return true
    return BY_ORDER.includes(id) || id === 'gift'
  }
  const isGift = ownStage === 'gift'
  const nameOf = (id: string) => {
    const c = sortedContacts.find((x) => String(x.ContactID) === id)
    return c ? cName(c) : '—'
  }

  const OWN_ROW2_MIN = 52

  const contactSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <div style={{ display: 'flex', gap: 6, alignItems: 'stretch', minHeight: OWN_ROW2_MIN }}>
      <select
        className="input"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...FIS, flex: 1, minWidth: 0, minHeight: OWN_ROW2_MIN, boxSizing: 'border-box' }}
      >
        <option value="">{t('select_option_placeholder')}</option>
        {!sortedContacts.some((c) => isPem(String(c.ContactID))) && (
          <option value={String(PEM_CONTACT_ID)}>{pemName}</option>
        )}
        {sortedContacts.map((c) => (
          <option key={c.ContactID} value={c.ContactID}>{cName(c)}</option>
        ))}
      </select>
      <button
        type="button"
        className="btn ghost sm"
        aria-label={t('wf_new_contact')}
        style={{ flexShrink: 0, width: OWN_ROW2_MIN, minWidth: OWN_ROW2_MIN, padding: 0, alignSelf: 'stretch' }}
        onClick={() => setShowNewContact(true)}
      >
        +
      </button>
    </div>
  )
  const readOnlyBox = (text: string) => (
    <div style={{ ...FIS, display: 'flex', alignItems: 'center', background: 'var(--bg2)44', opacity: 0.85, minHeight: OWN_ROW2_MIN, boxSizing: 'border-box' }}>
      {text}
    </div>
  )
  const pemName = pemContact?.NomInstitution ?? 'Pem'
  /** Pem is not always in the drawer's contact list; name it from the id. */
  const isPem = (id: string) => id === String(PEM_CONTACT_ID) || (!!pemContact && id === String(pemContact.ContactID))

  return (
    <>
      <section style={{ marginBottom: 16, opacity: (isOwnershipTransferred || isArchived) ? 0.55 : 1 }}>
        <SectionTitle title={t('wf_section_production')} />
        <WfPipeProgress
          stages={PRODUCTION_STAGES}
          current={prodStage}
          onSelect={(id) => {
            if (isOwnershipTransferred || isArchived) return
            setProdStage(id as ProdStageId)
          }}
          color={PROD_STAGE_COLOR[prodStage]}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
          <WfSwitch
            label={t('wf_photo_required')}
            checked={needsPhoto}
            onChange={(v) => {
              if (isOwnershipTransferred || isArchived) return
              setNeedsPhoto(v)
            }}
            disabled={isOwnershipTransferred || isArchived}
          />
        </div>
        {needsPhoto && prodStage === 'catalogued' && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--dust)22', border: '1px solid var(--dust)44', fontSize: 11, color: 'var(--tx2)' }}>
            {t('wf_photo_pending_hint')}
          </div>
        )}
      </section>

      <section style={{ marginBottom: 16 }}>
        <SectionTitle title={t('wf_section_ownership')} />
        <WfPipeProgress
          stages={OWNERSHIP_STAGES.map((s) => ({ ...s, disabled: stageDisabled(s.id) }))}
          current={ownStage}
          onSelect={(id) => { if (!stageDisabled(id as OwnStageId)) setOwnStage(id as OwnStageId) }}
          color="var(--cyan)"
        />
        {(lockedByOrder || isGift) && (
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--tx3)', lineHeight: 1.45 }}>
            {lockedByOrder ? t('custody_by_order_hint') : t('custody_gift_override_hint')}
          </div>
        )}
        <div
          style={{
            display: 'grid',
            marginTop: 12,
            gridTemplateColumns: narrow ? '1fr' : '1fr 1fr',
            gap: narrow ? 12 : '4px 12px',
            alignItems: 'start',
          }}
        >
          <div>
            <div className="t-label" style={{ fontSize: 10, marginBottom: 4 }}>
              {ownStage === 'reserved' ? t('custody_buyer') : t('custody_owner')}
            </div>
            {ownStage === 'reserved'
              ? contactSelect(buyerId, setBuyerId, t('custody_buyer'))
              : isGift
                ? contactSelect(ownerId, setOwnerId, t('custody_owner'))
                : readOnlyBox(ownStage === 'artist' || ownStage === 'artist_archive' || isPem(ownerId) ? pemName : nameOf(ownerId))}
            {ownStage === 'reserved' && (
              <div style={{ marginTop: 4, fontSize: 10, color: 'var(--tx3)' }}>
                {t('custody_owner')} : {pemName}
              </div>
            )}
          </div>
          <div>
            <div className="t-label" style={{ fontSize: 10, marginBottom: 4 }}>{t('custody_custodian')}</div>
            {isGift ? contactSelect(contactId, setContactId, t('custody_custodian')) : readOnlyBox(isPem(contactId) ? pemName : currentLoc)}
            <div
              style={{
                marginTop: 6,
                background: 'var(--bg2)',
                padding: '0 12px',
                border: '1px solid var(--bd)',
                borderRadius: 4,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxSizing: 'border-box',
              }}
            >
              <div className="t-label" style={{ fontSize: 9, flexShrink: 0 }}>{t('custody_address')}</div>
              <LocationAddressPicker
                addresses={locationAddresses}
                value={localisationAddressId}
                onChange={setLocalisationAddressId}
              />
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, borderTop: '1px solid var(--bd)', paddingTop: 12 }}>
          <div className="t-label" style={{ fontSize: 10, marginBottom: 6 }}>{t('wf_visibility_hdr')}</div>
          <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 8, lineHeight: 1.45 }}>{t('wf_visibility_blurb')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { level: 0, label: t('wf_vis_public'), desc: t('wf_vis_public_d') },
              { level: 1, label: t('wf_vis_masked'), desc: t('wf_vis_masked_d') },
              { level: 2, label: t('wf_vis_private'), desc: t('wf_vis_private_d') },
            ].map(({ level, label, desc }) => {
              const active = anonymityLevel === level
              return (
                <button
                  key={level}
                  type="button"
                  data-testid={`work-drawer-anonymity-${level}`}
                  aria-pressed={active}
                  title={desc}
                  onClick={() => setAnonymityLevel(level)}
                  style={{
                    flex: 1,
                    minWidth: 72,
                    padding: '8px 6px',
                    fontSize: 10,
                    border: `1px solid ${active ? 'var(--ac)' : 'var(--bd)'}`,
                    background: active ? 'var(--ac)22' : 'var(--bg2)',
                    color: active ? 'var(--ac)' : 'var(--tx2)',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {anonymityLevel === 2 && (
        <div style={{ marginBottom: 14, fontSize: 10, color: 'var(--rust)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--rust)' }} />
          {t('wf_vis_private_banner')}
        </div>
      )}
    </>
  )
}
