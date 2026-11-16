'use client'

// Work card R3 top block: technique · support · dimensions + format (40 F) · Période
// (« 2025 · commencée … · terminée … »). Read first, edit on tap; « + Nouveau … » kept on
// technique / support / format (`saveLookup` → `createLookup`). Folded: empty rows are left to the
// card's « N champs vides » line; expanded: they show greyed in place.

import { useState, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { DIAMETER_SIGN, isCircularSupport, yearOf } from '@/lib/data'
import { CreatableSelect, FIS } from './drawer-widgets'
import { TapEdit, TopLabel, EmptyValue, chipH } from './WorkCardParts'

type TechniqueRow = { TechniqueID: number; Technique: string | null }
type SupportRow = { SupportID: number; Support: string | null }
type FormatRow = { FormatID: number; Format: string | null }

export function WorkCardIdentity({
  narrow,
  folded,
  annee,
  setAnnee,
  techniqueId,
  setTechniqueId,
  supportId,
  setSupportId,
  formatId,
  setFormatId,
  hauteur,
  setHauteur,
  largeur,
  setLargeur,
  profondeur,
  setProfondeur,
  localTechniques,
  localSupports,
  localFormats,
  saveLookup,
  startedLabel,
  completedLabel,
}: {
  narrow: boolean
  folded: boolean
  annee: string
  setAnnee: (v: string) => void
  techniqueId: string
  setTechniqueId: (v: string) => void
  supportId: string
  setSupportId: (v: string) => void
  formatId: string
  setFormatId: (v: string) => void
  hauteur: string
  setHauteur: (v: string) => void
  largeur: string
  setLargeur: (v: string) => void
  profondeur: string
  setProfondeur: (v: string) => void
  localTechniques: TechniqueRow[]
  localSupports: SupportRow[]
  localFormats: FormatRow[]
  saveLookup: (table: string, name: string) => void | Promise<void>
  startedLabel: string
  completedLabel: string
}) {
  const { t } = useI18n()
  const [dimsOpen, setDimsOpen] = useState(false)
  const techLabel = localTechniques.find((r) => String(r.TechniqueID) === techniqueId)?.Technique ?? ''
  const supportLabel = localSupports.find((r) => String(r.SupportID) === supportId)?.Support ?? ''
  const formatLabel = localFormats.find((r) => String(r.FormatID) === formatId)?.Format ?? ''
  const circular = isCircularSupport(supportLabel)
  const isDigital = techniqueId === '19'
  const h = hauteur.trim()
  const w = largeur.trim()
  const d = profondeur.trim()
  const dimsText = circular
    ? [`${DIAMETER_SIGN} ${h || w}`, d].filter((x) => x && x.trim() !== DIAMETER_SIGN).join(' × ')
    : [h, w, d].filter(Boolean).join(' × ')
  const dimsEmpty = !h && !w && !d
  const year = yearOf(annee)
  const periodBits = [
    year != null ? String(year) : '',
    startedLabel ? t('wc_stage_started_fmt').replace('{date}', startedLabel) : '',
    completedLabel ? t('wc_completed_fmt').replace('{date}', completedLabel) : '',
  ].filter(Boolean)
  const inputH = narrow ? 44 : 32
  const inp = { ...FIS, height: inputH, padding: '0 8px' }

  const rows: { key: string; label: string; empty: boolean; node: ReactNode }[] = [
    {
      key: 'technique',
      label: t('technique'),
      empty: !techniqueId,
      node: (
        <TapEdit testId="wc-technique" empty={!techniqueId} emptyLabel={t('technique').toLowerCase()} display={techLabel}>
          <CreatableSelect
            value={techniqueId}
            options={localTechniques.map((r) => ({ id: String(r.TechniqueID), label: r.Technique ?? '' }))}
            onChange={setTechniqueId}
            onAdd={(name) => void saveLookup('Technique', name)}
          />
        </TapEdit>
      ),
    },
    {
      key: 'support',
      label: t('support'),
      empty: !supportId,
      node: (
        <TapEdit testId="wc-support" empty={!supportId} emptyLabel={t('support').toLowerCase()} display={supportLabel}>
          <CreatableSelect
            value={supportId}
            options={localSupports.map((r) => ({ id: String(r.SupportID), label: r.Support ?? '' }))}
            onChange={setSupportId}
            onAdd={(name) => void saveLookup('Support', name)}
          />
        </TapEdit>
      ),
    },
    {
      key: 'dims',
      label: t('wc_dims'),
      empty: dimsEmpty && !formatId,
      node: dimsOpen ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }} data-testid="wc-dims-edit">
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 0 }}>
            {circular ? (
              <>
                <span style={{ color: 'var(--tx3)', fontSize: 12 }} title={t('wf_diameter_tt')}>{DIAMETER_SIGN}</span>
                <input className="input" value={h || w} onChange={(e) => { setHauteur(e.target.value); setLargeur(e.target.value) }} style={{ ...inp, flex: 1, minWidth: 0 }} placeholder="cm" />
              </>
            ) : (
              <>
                <input className="input" value={hauteur} onChange={(e) => setHauteur(e.target.value)} style={{ ...inp, flex: 1, minWidth: 0 }} placeholder={isDigital ? 'H (px)' : 'H'} />
                <span style={{ color: 'var(--tx3)', fontSize: 10 }}>×</span>
                <input className="input" value={largeur} onChange={(e) => setLargeur(e.target.value)} style={{ ...inp, flex: 1, minWidth: 0 }} placeholder={isDigital ? 'W (px)' : 'W'} />
              </>
            )}
            <span style={{ color: 'var(--tx3)', fontSize: 10 }}>×</span>
            <input className="input" value={profondeur} onChange={(e) => setProfondeur(e.target.value)} style={{ ...inp, flex: 1, minWidth: 0 }} placeholder="D" />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
            <span style={{ fontSize: 10, color: 'var(--tx3)', flexShrink: 0 }}>{t('wc_format')}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <CreatableSelect
                value={formatId}
                options={localFormats.map((r) => ({ id: String(r.FormatID), label: r.Format ?? '' }))}
                onChange={setFormatId}
                onAdd={(name) => void saveLookup('Format', name)}
              />
            </div>
          </div>
          {isDigital && (h || w) ? (
            <div className="t-mono-xs" style={{ color: 'var(--ac)' }}>
              ≈ {(parseFloat(h) / (300 / 2.54)).toFixed(1)} × {(parseFloat(w) / (300 / 2.54)).toFixed(1)} cm (@300dpi) · {t('wf_fmt_digital')}
            </div>
          ) : null}
        </div>
      ) : dimsEmpty && !formatId ? (
        <EmptyValue label={t('wc_dims').toLowerCase()} onClick={() => setDimsOpen(true)} testId="wc-dims" />
      ) : (
        <button
          type="button"
          data-testid="wc-dims"
          title={t('wc_tap_edit')}
          onClick={() => setDimsOpen(true)}
          style={{ background: 'none', border: 'none', padding: '1px 0', color: 'var(--tx)', fontFamily: 'inherit', fontSize: 13, textAlign: 'left', cursor: 'text' }}
        >
          {dimsEmpty ? <span style={{ color: 'var(--mt)' }}>+ {t('wc_dims').toLowerCase()}</span> : <>{dimsText} {isDigital ? 'px' : 'cm'}</>}
          {formatLabel ? <span style={{ color: 'var(--tx3)' }}> · {formatLabel}</span> : null}
        </button>
      ),
    },
    {
      key: 'period',
      label: t('wc_period'),
      empty: periodBits.length === 0,
      node: (
        <TapEdit
          testId="wc-year"
          empty={periodBits.length === 0}
          emptyLabel={t('wc_year').toLowerCase()}
          display={<>{periodBits[0]}{periodBits.length > 1 ? <span style={{ color: 'var(--tx3)' }}> · {periodBits.slice(1).join(' · ')}</span> : null}</>}
        >
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
            <input className="input" value={annee} onChange={(e) => setAnnee(e.target.value)} style={{ ...inp, width: 130 }} placeholder="YYYY-MM-DD" aria-label={t('wc_year')} />
            {periodBits.slice(year != null ? 1 : 0).length ? (
              <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{periodBits.slice(year != null ? 1 : 0).join(' · ')}</span>
            ) : null}
          </div>
        </TapEdit>
      ),
    },
  ]

  const shown = folded ? rows.filter((r) => !r.empty) : rows
  if (shown.length === 0) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '96px minmax(0,1fr)', gap: '4px 12px', alignItems: 'center' }}>
      {shown.map((r) => (
        <div key={r.key} style={{ display: 'contents' }}>
          <TopLabel>{r.label}</TopLabel>
          <div style={{ minWidth: 0, minHeight: narrow ? 44 : chipH(narrow), display: 'flex', alignItems: 'center' }}>{r.node}</div>
        </div>
      ))}
    </div>
  )
}

/** Names of the empty top-block fields, for the folded card's « N champs vides » line. */
export function emptyIdentityLabels(
  t: (k: import('@/lib/i18n/dictionary').DictKey) => string,
  v: { annee: string; techniqueId: string; supportId: string; formatId: string; hauteur: string; largeur: string; profondeur: string; hasSpan: boolean },
): string[] {
  const out: string[] = []
  if (!v.techniqueId) out.push(t('technique').toLowerCase())
  if (!v.supportId) out.push(t('support').toLowerCase())
  if (!v.hauteur.trim() && !v.largeur.trim() && !v.profondeur.trim() && !v.formatId) out.push(t('wc_dims').toLowerCase())
  if (yearOf(v.annee) == null && !v.hasSpan) out.push(t('wc_year').toLowerCase())
  return out
}
