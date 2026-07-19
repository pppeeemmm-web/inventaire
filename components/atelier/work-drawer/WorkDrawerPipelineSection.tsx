'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useMemo } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { OwnStageId, ProdStageId } from '@/lib/work-editor-model'
import type { DrawerContactRow } from './drawer-content-props'
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
  contactId: string
  setContactId: Dispatch<SetStateAction<string>>
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

  const contactFieldLabel =
    ownStage === 'consigned' || ownStage === 'loan'
      ? t('wf_contact_custodian')
      : ownStage === 'reserved'
        ? t('wf_contact_buyer_intent')
        : t('wf_contact_acquire')

  const OWN_ROW2_MIN = 52

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
          color="var(--sage)"
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
          stages={OWNERSHIP_STAGES.map((s) => ({
            ...s,
            disabled: isOwnershipTransferred && s.id !== 'sold' && s.id !== 'gift',
          }))}
          current={ownStage}
          onSelect={(id) => setOwnStage(id as OwnStageId)}
          color="var(--cyan)"
        />
        {narrow ? (
          <div style={{ marginTop: 12 }}>
            <div className="t-label" style={{ fontSize: 10, marginBottom: 4 }}>{contactFieldLabel}</div>
            {ownStage === 'artist' || ownStage === 'artist_archive' ? (
              <div
                style={{
                  ...FIS,
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg2)44',
                  opacity: 0.85,
                  minHeight: OWN_ROW2_MIN,
                  boxSizing: 'border-box',
                }}
              >
                {pemContact?.NomInstitution ?? 'Pem'}
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'stretch',
                  minHeight: OWN_ROW2_MIN,
                  boxSizing: 'border-box',
                }}
              >
                <select
                  className="input"
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  style={{ ...FIS, flex: 1, minHeight: OWN_ROW2_MIN, height: '100%', boxSizing: 'border-box' }}
                >
                  <option value="">{t('select_option_placeholder')}</option>
                  {sortedContacts.map((c) => (
                    <option key={c.ContactID} value={c.ContactID}>{cName(c)}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn ghost sm"
                  style={{
                    flexShrink: 0,
                    width: OWN_ROW2_MIN,
                    minWidth: OWN_ROW2_MIN,
                    minHeight: OWN_ROW2_MIN,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'stretch',
                    padding: 0,
                    boxSizing: 'border-box',
                  }}
                  onClick={() => setShowNewContact(true)}
                >
                  +
                </button>
              </div>
            )}
            <div className="t-label" style={{ fontSize: 9, marginBottom: 4, marginTop: 12 }}>{t('wf_localisation_now')}</div>
            <div
              style={{
                background: 'var(--bg2)',
                padding: '0 12px',
                border: '1px solid var(--bd)',
                borderRadius: 4,
                minHeight: OWN_ROW2_MIN,
                display: 'flex',
                alignItems: 'center',
                boxSizing: 'border-box',
              }}
            >
              <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--ac)' }}>{currentLoc}</div>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              marginTop: 12,
              gridTemplateColumns: '1fr 1fr',
              columnGap: 12,
              rowGap: 4,
              gridTemplateRows: `auto minmax(${OWN_ROW2_MIN}px, auto)`,
            }}
          >
            <div className="t-label" style={{ fontSize: 10, marginBottom: 0 }}>{contactFieldLabel}</div>
            <div className="t-label" style={{ fontSize: 9, marginBottom: 0 }}>{t('wf_localisation_now')}</div>
            {ownStage === 'artist' || ownStage === 'artist_archive' ? (
              <div
                style={{
                  ...FIS,
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg2)44',
                  opacity: 0.85,
                  minHeight: OWN_ROW2_MIN,
                  height: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {pemContact?.NomInstitution ?? 'Pem'}
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'stretch',
                  minHeight: OWN_ROW2_MIN,
                  height: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <select
                  className="input"
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  style={{ ...FIS, flex: 1, minHeight: 0, height: '100%', boxSizing: 'border-box' }}
                >
                  <option value="">{t('select_option_placeholder')}</option>
                  {sortedContacts.map((c) => (
                    <option key={c.ContactID} value={c.ContactID}>{cName(c)}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn ghost sm"
                  style={{
                    flexShrink: 0,
                    width: OWN_ROW2_MIN,
                    minWidth: OWN_ROW2_MIN,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'stretch',
                    padding: 0,
                    boxSizing: 'border-box',
                  }}
                  onClick={() => setShowNewContact(true)}
                >
                  +
                </button>
              </div>
            )}
            <div
              style={{
                background: 'var(--bg2)',
                padding: '0 12px',
                border: '1px solid var(--bd)',
                borderRadius: 4,
                height: '100%',
                minHeight: OWN_ROW2_MIN,
                display: 'flex',
                alignItems: 'center',
                boxSizing: 'border-box',
              }}
            >
              <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--ac)' }}>{currentLoc}</div>
            </div>
          </div>
        )}
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
