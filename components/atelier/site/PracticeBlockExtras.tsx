'use client'

import { useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { PortfolioConfig } from '@/lib/portfolio-config-types'
import { DualField } from '@/components/atelier/portfolio/shared/DualField'
import { EditorFadeShell } from '@/components/atelier/portfolio/shared/EditorFadeShell'

const FADE_MASK =
  'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 100%)'

const THEMES_COLLAPSE_LINES = 4
const MATERIALS_COLLAPSE_MIN = 80

type PracticeBlockExtrasProps = {
  practice: PortfolioConfig['practice']
  onThemes: (themes: string[]) => void
  onMaterialsFr: (v: string) => void
  onMaterialsEn: (v: string) => void
}

export function PracticeBlockExtras({
  practice,
  onThemes,
  onMaterialsFr,
  onMaterialsEn,
}: PracticeBlockExtrasProps) {
  const { t } = useI18n()
  const themes = practice.themes ?? []
  const materialsLen = (practice.materials_fr?.length ?? 0) + (practice.materials_en?.length ?? 0)
  const collapsible = themes.length > THEMES_COLLAPSE_LINES || materialsLen > MATERIALS_COLLAPSE_MIN
  const [expanded, setExpanded] = useState(!collapsible)

  const previewThemes = themes.slice(0, 5).join('\n')
  const previewMaterials = [practice.materials_fr?.trim(), practice.materials_en?.trim()]
    .filter(Boolean)
    .join(' · ')

  const fadePreview = collapsible ? (
    <div style={{ padding: '10px 12px', fontSize: 10, lineHeight: 1.6, color: 'var(--tx2)' }}>
      {previewThemes ? (
        <pre style={{ margin: '0 0 8px 0', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{previewThemes}</pre>
      ) : null}
      {previewMaterials ? (
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{previewMaterials}</p>
      ) : null}
      {!previewThemes && !previewMaterials ? (
        <span style={{ opacity: 0.35 }}>—</span>
      ) : null}
    </div>
  ) : null

  const editors = useMemo(() => (
    <>
      <div style={{ marginTop: 20 }}>
        <label className="t-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>
          {t('site_practice_core_themes_label')}
        </label>
        <textarea
          className="input full"
          rows={5}
          value={themes.join('\n')}
          onChange={e => onThemes(
            e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean),
          )}
          placeholder={t('site_practice_core_themes_placeholder')}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>
      <div style={{ marginTop: 20 }}>
        <DualField
          label={t('site_practice_materials_label')}
          fr={practice.materials_fr}
          en={practice.materials_en}
          onFr={onMaterialsFr}
          onEn={onMaterialsEn}
        />
      </div>
    </>
  ), [practice.materials_en, practice.materials_fr, onMaterialsEn, onMaterialsFr, onThemes, t, themes])

  if (!collapsible) {
    return <>{editors}</>
  }

  return (
    <div style={{ marginTop: 20 }}>
      {!expanded && fadePreview ? (
        <div style={{
          position: 'relative', maxHeight: 88, overflow: 'hidden',
          borderRadius: 4, border: '1px solid var(--bd)', background: 'var(--bg0)', marginBottom: 6,
        }}>
          <div style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}>
            {fadePreview}
          </div>
        </div>
      ) : null}
      <EditorFadeShell
        expanded={expanded}
        onToggle={() => setExpanded(v => !v)}
        preview={undefined}
        expandLabelKey="site_practice_extras_expand"
        collapseLabelKey="site_practice_extras_collapse"
      >
        {editors}
      </EditorFadeShell>
    </div>
  )
}
