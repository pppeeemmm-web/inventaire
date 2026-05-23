'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { PortfolioConfig, CollectionItem, WorksMode, ThemeWork, SiteBlockKind } from '@/lib/portfolio-config-types'
import { isHttpsHeroUrl, reorder } from '@/lib/portfolio-config-types'
import { SitePublicSection } from '@/components/atelier/portfolio/shared/SitePublicSection'
import { Slot } from '@/components/atelier/portfolio/shared/Slot'
import { DualField } from '@/components/atelier/portfolio/shared/DualField'
import { CollectionRow } from '@/components/atelier/portfolio/shared/CollectionRow'
import { moveBtnStyle } from '@/components/atelier/portfolio/shared/moveBtnStyle'

interface SiteEditorProps {
  config: PortfolioConfig
  setConfig: (c: PortfolioConfig) => void
  activeMode: number
  setActiveMode: (i: number) => void
  activeSlot: { type: 'theme'; page: 'works' | 'sections'; index: number; modeIdx?: number } | null
  setActiveSlot: (s: SiteEditorProps['activeSlot']) => void
  themeNameStats: Record<string, { total: number; pub: number }>
  themeNamePrivateWorks: Record<string, ThemeWork[]>
  onMakePublic: (id: number) => void
  addMode: () => void
  deleteMode: (i: number) => void
  moveMode: (from: number, to: number) => void
  updateMode: (i: number, patch: Partial<WorksMode>) => void
  addModeCollection: (m: number) => void
  moveModeCollection: (m: number, from: number, to: number) => void
  updateModeCollection: (m: number, i: number, patch: Partial<CollectionItem>) => void
  deleteModeCollection: (m: number, id: string) => void
}

const BLOCK_ICONS: Record<SiteBlockKind, string> = {
  hero: '◎',
  identity: '◈',
  about: '✎',
  practice: '◉',
  works_modes: '▤',
}

const BLOCK_LABEL_KEYS: Record<SiteBlockKind, string> = {
  hero: 'site_block_hero',
  identity: 'site_block_identity',
  about: 'site_block_about',
  practice: 'site_block_practice',
  works_modes: 'site_block_works_modes',
}

export function SiteEditorPanel({
  config, setConfig,
  activeMode, setActiveMode,
  activeSlot, setActiveSlot,
  themeNameStats, themeNamePrivateWorks,
  onMakePublic,
  addMode, deleteMode, moveMode, updateMode,
  addModeCollection, moveModeCollection, updateModeCollection, deleteModeCollection,
}: SiteEditorProps) {
  const { t } = useI18n()
  const blocks = config.site_blocks
  const [collapsed, setCollapsed] = useState<Set<SiteBlockKind>>(new Set())

  function moveBlock(from: number, to: number) {
    setConfig({ ...config, site_blocks: reorder(blocks, from, to) })
  }

  function toggleVisible(idx: number) {
    const next = blocks.map((b, i) => i === idx ? { ...b, visible: !b.visible } : b)
    setConfig({ ...config, site_blocks: next })
  }

  function toggleCollapsed(kind: SiteBlockKind) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  function renderBlockContent(kind: SiteBlockKind) {
    switch (kind) {
      case 'hero':
        return (
          <>
            <p className="t-mono-xs" style={{ opacity: 0.55, marginBottom: 12, lineHeight: 1.5 }}>{t('atelier_pub_hero_url_help')}</p>
            <p className="t-mono-xs" style={{ opacity: 0.4, marginBottom: 16, fontSize: 9 }}>{t('atelier_pub_hero_r2_followup')}</p>
            <label className="t-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>{t('atelier_pub_hero_url_label')}</label>
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              className="input full"
              placeholder={t('atelier_pub_hero_url_placeholder')}
              value={config.landing.hero_image_url}
              onChange={e => setConfig({
                ...config,
                landing: { ...config.landing, hero_image_url: e.target.value },
              })}
            />
            {isHttpsHeroUrl(config.landing.hero_image_url) && (
              <div style={{ marginTop: 16 }}>
                <div className="t-label" style={{ marginBottom: 4, fontSize: 9 }}>{t('atelier_pub_hero_preview_label')}</div>
                <p className="t-mono-xs" style={{ opacity: 0.45, marginBottom: 12, fontSize: 9, wordBreak: 'break-all' }}>
                  {config.landing.hero_image_url.trim().replace(/^https?:\/\/[^/]+/, '')}
                </p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 8, letterSpacing: 1, color: 'var(--tx3)', marginBottom: 6 }}>CERCLE</div>
                    <img src={config.landing.hero_image_url.trim()} alt="circle crop"
                      style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: '50%', border: '1px solid var(--bd)' }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 8, letterSpacing: 1, color: 'var(--tx3)', marginBottom: 6 }}>1:1</div>
                    <img src={config.landing.hero_image_url.trim()} alt="1:1 crop"
                      style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)' }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 8, letterSpacing: 1, color: 'var(--tx3)', marginBottom: 6 }}>4:3</div>
                    <img src={config.landing.hero_image_url.trim()} alt="4:3 crop"
                      style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)' }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 8, letterSpacing: 1, color: 'var(--tx3)', marginBottom: 6 }}>3:4</div>
                    <img src={config.landing.hero_image_url.trim()} alt="3:4 crop"
                      style={{ width: 90, height: 120, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)' }} />
                  </div>
                </div>
              </div>
            )}
          </>
        )

      case 'identity':
        return (
          <>
            <div className="site-pub-grid-2" style={{ marginBottom: 20 }}>
              <Slot label="Nom de l'artiste">
                <input className="input full" value={config.general.artist_name}
                  onChange={e => setConfig({ ...config, general: { ...config.general, artist_name: e.target.value } })} />
              </Slot>
              <Slot label="Email public">
                <input className="input full" value={config.general.contact_email}
                  onChange={e => setConfig({ ...config, general: { ...config.general, contact_email: e.target.value } })} />
              </Slot>
              <Slot label="Instagram">
                <input className="input full" value={config.general.instagram}
                  onChange={e => setConfig({ ...config, general: { ...config.general, instagram: e.target.value } })} />
              </Slot>
              {/* eslint-disable pem-i18n/no-hardcoded-jsx-text */}
              <Slot label="Téléphone">
                <input className="input full" value={config.general.phone}
                  onChange={e => setConfig({ ...config, general: { ...config.general, phone: e.target.value } })} />
              </Slot>
              {/* eslint-enable pem-i18n/no-hardcoded-jsx-text */}
            </div>
            <DualField label="Accroche médiums"
              fr={config.general.media_tagline_fr} en={config.general.media_tagline_en}
              onFr={v => setConfig({ ...config, general: { ...config.general, media_tagline_fr: v } })}
              onEn={v => setConfig({ ...config, general: { ...config.general, media_tagline_en: v } })}
              placeholder={{ fr: 'Peinture · Dessin · Sculpture', en: 'Painting · Drawing · Sculpture' }} />
          </>
        )

      case 'about':
        return (
          <DualField label="Texte d'introduction" rich allowImport preview="prose"
            fr={config.about.intro_fr} en={config.about.intro_en}
            onFr={v => setConfig({ ...config, about: { ...config.about, intro_fr: v } })}
            onEn={v => setConfig({ ...config, about: { ...config.about, intro_en: v } })} />
        )

      case 'practice':
        return (
          <>
            <DualField label="Approche / statement" rich allowImport preview="prose"
              fr={config.practice.approach_fr} en={config.practice.approach_en}
              onFr={v => setConfig({ ...config, practice: { ...config.practice, approach_fr: v } })}
              onEn={v => setConfig({ ...config, practice: { ...config.practice, approach_en: v } })} />
            <div style={{ marginTop: 20 }}>
              <label className="t-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>
                {/* eslint-disable-next-line pem-i18n/no-hardcoded-jsx-text */}
                THÈMES CENTRAUX (un par ligne)
              </label>
              <textarea
                className="input full"
                rows={5}
                value={(config.practice.themes ?? []).join('\n')}
                onChange={e => setConfig({
                  ...config,
                  practice: {
                    ...config.practice,
                    themes: e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean)
                  }
                })}
                placeholder="La physiologie de la perception…"
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ marginTop: 20 }}>
              <DualField label="Médiums & matériaux"
                fr={config.practice.materials_fr} en={config.practice.materials_en}
                onFr={v => setConfig({ ...config, practice: { ...config.practice, materials_fr: v } })}
                onEn={v => setConfig({ ...config, practice: { ...config.practice, materials_en: v } })} />
            </div>
          </>
        )

      case 'works_modes': {
        const mode = config.works_modes[activeMode]
        return (
          <>
            {config.works_modes.length <= 1 && (
              <p className="t-mono-xs" style={{ opacity: 0.5, marginBottom: 16, maxWidth: 720, lineHeight: 1.45 }}>
                {`Séquences de la page `}<code style={{ opacity: 0.85 }}>/works</code>{` et carte de clôture.`}
              </p>
            )}

            {/* Layout selector — always visible */}
            {mode && (
              <div style={{ marginBottom: 20 }}>
                <div className="t-label" style={{ marginBottom: 8, fontSize: 9 }}>{t('site_works_layout_label').toUpperCase()}</div>
                <div style={{ display: 'inline-flex', border: '1px solid var(--bd)', borderRadius: 4, overflow: 'hidden' }}>
                  {(['carousel', 'grid'] as const).map(v => {
                    const active = (mode.layout || 'carousel') === v
                    return (
                      <button key={v} type="button"
                        className="t-mono-xs"
                        onClick={() => updateMode(activeMode, { layout: v })}
                        style={{
                          padding: '6px 14px', minHeight: 36,
                          fontSize: 9, letterSpacing: 1, fontFamily: 'inherit', textTransform: 'uppercase',
                          border: 'none', cursor: 'pointer',
                          background: active ? 'var(--ac)' : 'var(--bg1)',
                          color: active ? '#fff' : 'var(--tx2)',
                          transition: 'background 0.15s, color 0.15s',
                        }}>
                        {t(v === 'carousel' ? 'site_works_layout_carousel' : 'site_works_layout_grid')}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {/* eslint-disable pem-i18n/no-hardcoded-jsx-text */}
            {config.works_modes.length > 1 && (
              <p className="t-mono-xs" style={{ opacity: 0.5, marginBottom: 16 }}>
                Chaque mode devient un sous-onglet sur <code>/works</code>, avec ses collections et sa carte de cl&#xF4;ture.
              </p>
            )}
            {/* eslint-enable pem-i18n/no-hardcoded-jsx-text */}

            {config.works_modes.length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: '1px solid var(--bd)', marginBottom: 24, paddingBottom: 8 }}>
                {config.works_modes.map((m, i) => {
                  const isActive = i === activeMode
                  return (
                    <div key={m.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', borderRadius: 4,
                      background: isActive ? 'var(--ac)' : 'var(--bg1)',
                      border: '1px solid ' + (isActive ? 'var(--ac)' : 'var(--bd)'),
                      color: isActive ? '#fff' : 'var(--tx2)',
                      opacity: m.is_active ? 1 : 0.5,
                    }}>
                      <button onClick={() => setActiveMode(i)} className="t-mono-xs"
                        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 10, letterSpacing: 1, fontFamily: 'inherit', textTransform: 'uppercase' }}>
                        {m.label_fr || m.label_en || `Mode ${i + 1}`}
                      </button>
                      <span className="t-mono-xs" style={{ fontSize: 8, opacity: 0.6 }}>{i + 1}/{config.works_modes.length}</span>
                      <button onClick={() => moveMode(i, i - 1)} disabled={i === 0}
                        title={t('site_mode_move_left')} style={{ ...moveBtnStyle(i === 0), width: 16, height: 16, fontSize: 9 }}>{'←'}</button>
                      <button onClick={() => moveMode(i, i + 1)} disabled={i === config.works_modes.length - 1}
                        title={t('site_mode_move_right')} style={{ ...moveBtnStyle(i === config.works_modes.length - 1), width: 16, height: 16, fontSize: 9 }}>{'→'}</button>
                    </div>
                  )
                })}
              </div>
            )}

            {mode && (
              <div className="col gap-lg" style={{ gap: 28 }}>
                {config.works_modes.length > 1 && (
                  <div className="site-pub-grid-mode">
                    <div>
                      <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>{`LIBELLÉ ONGLET FR`}</label>
                      <input className="input full" value={mode.label_fr} onChange={e => updateMode(activeMode, { label_fr: e.target.value })} />
                    </div>
                    <div>
                      <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>{`LIBELLÉ ONGLET EN`}</label>
                      <input className="input full" value={mode.label_en} onChange={e => updateMode(activeMode, { label_en: e.target.value })} />
                    </div>
                    <label className="row gap-xs pointer center" style={{ paddingBottom: 6 }}>
                      <input type="checkbox" checked={mode.is_active} onChange={e => updateMode(activeMode, { is_active: e.target.checked })} />
                      <span className="t-mono-xs" style={{ fontSize: 9 }}>ACTIF</span>
                    </label>
                    <button className="t-mono-sm" style={{ color: 'var(--rust)', cursor: 'pointer', border: 'none', background: 'none', paddingBottom: 6, fontSize: 11 }}
                      onClick={() => deleteMode(activeMode)}
                      disabled={config.works_modes.length <= 1}
                      title={config.works_modes.length <= 1 ? 'Au moins un mode requis' : 'Supprimer ce mode'}>
                      {/* eslint-disable pem-i18n/no-hardcoded-jsx-text */}
                      Supprimer mode
                      {/* eslint-enable pem-i18n/no-hardcoded-jsx-text */}
                    </button>
                  </div>
                )}

                <div>
                  {config.works_modes.length > 1 && (
                    <div className="t-label" style={{ marginBottom: 8, fontSize: 9 }}>COLLECTIONS DU MODE ({mode.collections.length})</div>
                  )}
                  <p className="t-mono-xs" style={{ opacity: 0.5, marginBottom: 12, maxWidth: 720, lineHeight: 1.45 }}>
                    {`Glisser ⦂⦂ ou ↑↓ pour réordonner.`}
                  </p>
                  <div className="col gap-md">
                    {mode.collections.map((item, i) => (
                      <CollectionRow key={item.id} item={item}
                        index={i} total={mode.collections.length}
                        sequenceLabel={`Séquence ${i + 1}`}
                        onMove={(from, to) => moveModeCollection(activeMode, from, to)}
                        isTarget={activeSlot?.page === 'works' && activeSlot?.modeIdx === activeMode && activeSlot?.index === i}
                        onAssign={() => setActiveSlot({ type: 'theme', page: 'works', index: i, modeIdx: activeMode })}
                        onUpdate={p => updateModeCollection(activeMode, i, p)}
                        onDelete={() => deleteModeCollection(activeMode, item.id)}
                        themeStats={themeNameStats}
                        privateWorks={item.theme ? themeNamePrivateWorks[item.theme] : undefined}
                        onMakePublic={onMakePublic} />
                    ))}
                    <button className="btn sm ghost" onClick={() => addModeCollection(activeMode)} style={{ alignSelf: 'flex-start' }}>
                      + Collection
                    </button>
                  </div>
                </div>

                <div>
                  <div className="t-label" style={{ marginBottom: 8, fontSize: 9 }}>CARTE DE CLÔTURE — texte affiché après la dernière œuvre</div>
                  <DualField label="" rich allowImport preview="prose"
                    fr={mode.outro_fr} en={mode.outro_en}
                    onFr={v => updateMode(activeMode, { outro_fr: v })}
                    onEn={v => updateMode(activeMode, { outro_en: v })} />
                </div>
              </div>
            )}

            {config.works_modes.length <= 1 && (
              <button type="button" className="t-mono-xs" onClick={addMode}
                style={{ marginTop: 20, background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 9, letterSpacing: 1, opacity: 0.6 }}>
                + Ajouter un mode (sous-onglets)
              </button>
            )}
          </>
        )
      }
    }
  }

  return (
    <div className="col gap-lg" style={{ gap: 24 }}>
      {blocks.map((block, idx) => {
        const isHidden = !block.visible
        const isCollapsed = isHidden && collapsed.has(block.kind)
        const title = t(BLOCK_LABEL_KEYS[block.kind] as any)
        const icon = BLOCK_ICONS[block.kind]

        const actionBar = (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isHidden && (
              <span className="t-mono-xs" style={{
                fontSize: 8, letterSpacing: 1, textTransform: 'uppercase',
                color: 'var(--rust)', opacity: 0.8,
              }}>
                {t('site_block_hidden_badge')}
              </span>
            )}
            <button
              type="button"
              onClick={() => toggleVisible(idx)}
              title={t('site_block_toggle_visible')}
              style={{
                ...moveBtnStyle(false),
                opacity: isHidden ? 0.5 : 1,
                fontSize: 13,
              }}
              aria-label={t('site_block_toggle_visible')}
            >
              {isHidden ? '◻' : '◼'}
            </button>
            <button
              type="button"
              onClick={() => moveBlock(idx, idx - 1)}
              disabled={idx === 0}
              title={t('site_block_move_up')}
              style={moveBtnStyle(idx === 0)}
              aria-label={t('site_block_move_up')}
            >↑</button>
            <button
              type="button"
              onClick={() => moveBlock(idx, idx + 1)}
              disabled={idx === blocks.length - 1}
              title={t('site_block_move_down')}
              style={moveBtnStyle(idx === blocks.length - 1)}
              aria-label={t('site_block_move_down')}
            >↓</button>
          </div>
        )

        const worksAction = block.kind === 'works_modes' && config.works_modes.length > 1
          ? <button className="btn sm ghost" onClick={addMode}>+ Mode</button>
          : undefined

        return (
          <div key={block.kind} style={{ opacity: isHidden ? 0.5 : 1, transition: 'opacity 0.15s' }}>
            <SitePublicSection
              title={block.kind === 'works_modes'
                ? (config.works_modes.length > 1 ? `${title} — Modes` : `${title} — Collections`)
                : title}
              icon={icon}
              testId={`atelier-pub-block-${block.kind}`}
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {worksAction}
                  {actionBar}
                </div>
              }
            >
              {isHidden ? (
                <button
                  type="button"
                  className="t-mono-xs"
                  onClick={() => toggleCollapsed(block.kind)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--tx3)',
                    cursor: 'pointer', fontSize: 9, letterSpacing: 1, opacity: 0.6,
                  }}
                >
                  {isCollapsed ? '▸ …' : '▾ …'}
                </button>
              ) : null}
              {(!isHidden || !isCollapsed) && renderBlockContent(block.kind)}
            </SitePublicSection>
          </div>
        )
      })}
    </div>
  )
}
