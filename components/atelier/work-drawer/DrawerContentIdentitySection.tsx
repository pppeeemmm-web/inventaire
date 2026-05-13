'use client'

import type { Dispatch, SetStateAction } from 'react'
import { DIAMETER_SIGN, isCircularSupport } from '@/lib/data'
import { CreatableSelect, FIS, Label, SectionTitle, Switch, WfSwitch } from './drawer-widgets'

type TechniqueRow = { TechniqueID: number; Technique: string | null }
type SupportRow = { SupportID: number; Support: string | null }
type ThemeRow = { id: number; name: string }
type PresentationRow = { PresentationID: number; Nom: string | null }

export function DrawerContentIdentitySection({
  t,
  annee,
  setAnnee,
  techniqueId,
  setTechniqueId,
  supportId,
  setSupportId,
  hauteur,
  setHauteur,
  largeur,
  setLargeur,
  profondeur,
  setProfondeur,
  localTechniques,
  localSupports,
  saveLookup,
  encadree,
  setEncadree,
  broadcastReady,
  setBroadcastReady,
  broadcastCaptionSeed,
  setBroadcastCaptionSeed,
  presentationId,
  setPresentationId,
  initialPresentations,
  initialThemes,
  selThemes,
  setSelThemes,
}: {
  t: (k: string) => string
  annee: string
  setAnnee: (v: string) => void
  techniqueId: string
  setTechniqueId: (v: string) => void
  supportId: string
  setSupportId: (v: string) => void
  hauteur: string
  setHauteur: (v: string) => void
  largeur: string
  setLargeur: (v: string) => void
  profondeur: string
  setProfondeur: (v: string) => void
  localTechniques: TechniqueRow[]
  localSupports: SupportRow[]
  saveLookup: (table: string, name: string) => void | Promise<void>
  encadree: boolean
  setEncadree: (v: boolean) => void
  broadcastReady: boolean
  setBroadcastReady: (v: boolean) => void
  broadcastCaptionSeed: string
  setBroadcastCaptionSeed: (v: string) => void
  presentationId: string
  setPresentationId: (v: string) => void
  initialPresentations: PresentationRow[]
  initialThemes: ThemeRow[]
  selThemes: Set<number>
  setSelThemes: Dispatch<SetStateAction<Set<number>>>
}) {
  const supportLabel =
    localSupports.find((s) => String(s.SupportID) === supportId)?.Support ?? ''
  const circularPlanar = isCircularSupport(supportLabel)
  const diameterFieldValue = (() => {
    if (!circularPlanar) return hauteur
    const a = hauteur.trim()
    const b = largeur.trim()
    if (a === b) return hauteur
    return hauteur || largeur
  })()
  const isDigital = techniqueId === '19'
  const pxToCm = (px: string) => (px ? (parseFloat(px) / (300 / 2.54)).toFixed(1) : '')

  return (
    <section>
      <SectionTitle title={t('wf_section_identity')} />
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '6px 12px', fontSize: 12 }}>
        <Label>{t('year')}</Label>
        <input className="input" value={annee} onChange={(e) => setAnnee(e.target.value)} style={FIS} placeholder="YYYY-MM-DD" />

        <Label>{t('technique')}</Label>
        <CreatableSelect
          value={techniqueId}
          options={localTechniques.map((row) => ({ id: String(row.TechniqueID), label: row.Technique ?? '' }))}
          onChange={setTechniqueId}
          onAdd={(name: string) => void saveLookup('Technique', name)}
        />

        <Label>{t('support')}</Label>
        <CreatableSelect
          value={supportId}
          options={localSupports.map((row) => ({ id: String(row.SupportID), label: row.Support ?? '' }))}
          onChange={setSupportId}
          onAdd={(name: string) => void saveLookup('Support', name)}
        />

        <Label>Dim.</Label>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          {circularPlanar ? (
            <>
              <span style={{ color: 'var(--tx3)', fontSize: 12, lineHeight: 1 }} title={t('wf_diameter_tt')}>
                {DIAMETER_SIGN}
              </span>
              <input
                className="input"
                value={diameterFieldValue}
                onChange={(e) => {
                  const v = e.target.value
                  setHauteur(v)
                  setLargeur(v)
                }}
                style={{ ...FIS, width: '34%', minWidth: 52 }}
                placeholder="cm"
              />
              <span style={{ color: 'var(--tx3)', fontSize: 10 }}>×</span>
              <input className="input" value={profondeur} onChange={(e) => setProfondeur(e.target.value)} style={{ ...FIS, width: '30%' }} placeholder="D" />
            </>
          ) : (
            <>
              <input className="input" value={hauteur} onChange={(e) => setHauteur(e.target.value)} style={{ ...FIS, width: '30%' }} placeholder={isDigital ? 'H (px)' : 'H'} />
              <span style={{ color: 'var(--tx3)', fontSize: 10 }}>×</span>
              <input className="input" value={largeur} onChange={(e) => setLargeur(e.target.value)} style={{ ...FIS, width: '30%' }} placeholder={isDigital ? 'W (px)' : 'W'} />
              <span style={{ color: 'var(--tx3)', fontSize: 10 }}>×</span>
              <input className="input" value={profondeur} onChange={(e) => setProfondeur(e.target.value)} style={{ ...FIS, width: '30%' }} placeholder="D" />
            </>
          )}
        </div>
        {isDigital && (
          <div style={{ gridColumn: '1 / -1', marginTop: 4, padding: 10, border: '1px solid var(--bd)', background: 'var(--bg2)', fontSize: 11 }}>
            <div className="t-eyebrow" style={{ marginBottom: 6 }}>
              {t('wf_fmt_digital')}
            </div>
            <div className="t-mono-xs" style={{ color: 'var(--ac)' }}>
              ≈ {pxToCm(hauteur)} × {pxToCm(largeur)} cm (@300dpi)
            </div>
          </div>
        )}

        <Label>{t('framed')}</Label>
        <div style={{ paddingTop: 2 }}>
          <Switch checked={encadree} onChange={setEncadree} />
        </div>

        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <WfSwitch testId="wf-broadcast-ready-switch" label={t('wf_broadcast_ready')} checked={broadcastReady} onChange={setBroadcastReady} />
          <div style={{ fontSize: 10, color: 'var(--tx3)', lineHeight: 1.4 }}>{t('wf_broadcast_ready_hint')}</div>
          {broadcastReady && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)' }}>{t('bc_caption_seed')}</label>
              <textarea
                data-testid="wf-broadcast-caption-seed"
                value={broadcastCaptionSeed}
                onChange={(e) => setBroadcastCaptionSeed(e.target.value.slice(0, 2000))}
                rows={3}
                className="input"
                style={{ ...FIS, height: 'auto', resize: 'vertical', minHeight: 64, padding: 8, fontSize: 12, lineHeight: 1.4 }}
              />
              <div style={{ fontSize: 10, color: 'var(--tx3)', lineHeight: 1.4 }}>{t('bc_caption_seed_hint')}</div>
            </div>
          )}
        </div>

        <Label>{t('presentation')}</Label>
        <select className="input" value={presentationId} onChange={(e) => setPresentationId(e.target.value)} style={FIS}>
          <option value="">—</option>
          {initialPresentations.map((p) => (
            <option key={p.PresentationID} value={p.PresentationID}>
              {p.Nom}
            </option>
          ))}
        </select>

        <Label>{t('concept_view_themes')}</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {initialThemes.map((th) => {
            const active = selThemes.has(th.id)
            return (
              <button
                key={th.id}
                type="button"
                onClick={() =>
                  setSelThemes((p: Set<number>) => {
                    const s = new Set(p)
                    if (s.has(th.id)) s.delete(th.id)
                    else s.add(th.id)
                    return s
                  })
                }
                style={{
                  padding: '2px 7px',
                  fontSize: 9,
                  borderRadius: 2,
                  border: '1px solid var(--bd)',
                  background: active ? 'var(--ac)' : 'var(--bg2)',
                  color: active ? 'var(--bg1)' : 'var(--tx3)',
                  cursor: 'pointer',
                }}
              >
                {th.name}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
