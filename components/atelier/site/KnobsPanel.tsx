'use client'

import { useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Slider } from '@/components/atelier/portfolio/shared/Slider'
import { Knob } from '@/components/atelier/portfolio/shared/Knob'
import type { KnobsConfig, KnobValues, KnobFamily } from '@/lib/site-blocks'
import { DEFAULT_KNOB_VALUES, mergeKnobFamilies } from '@/lib/site-blocks'
import type { KnobFamilyOverrides } from '@/lib/site-blocks'
import {
  LANDING_HERO_BEVEL_PROFILE_VALUES,
  LANDING_HERO_BEVEL_PX_MAX,
} from '@/lib/landing-hero-bevel'
import {
  WORKS_LIGHT_TEMP_MIN,
  WORKS_LIGHT_TEMP_MAX,
  WORKS_LIGHT_INTENSITY_MIN,
  WORKS_LIGHT_INTENSITY_MAX,
  WORKS_CAST_SHADOW_DISTANCE_MIN,
  WORKS_CAST_SHADOW_DISTANCE_MAX,
  WORKS_CAST_SHADOW_BLUR_MIN,
  WORKS_CAST_SHADOW_BLUR_MAX,
} from '@/lib/works-mode-light'
import { normalizeHexColor } from '@/lib/landing-background'
import {
  CIRCADIAN_PRESETS,
  type CircadianPreset,
} from '@/lib/circadian-knobs'

// ── Types ──────────────────────────────────────────────────────────────────

type PageScope = 'landing' | 'works' | 'about'
type Scope = 'site' | PageScope | 'block'

/** Loose view of one knob family for generic field get/set. */
type AnyFam = Record<string, unknown>

type KnobRow = { k: 'knob'; family: KnobFamily; field: string; label: string; min: number; max: number; step?: number; unit?: string; mul?: number }
type BoolRow = { k: 'bool'; family: KnobFamily; field: string; label: string }
type EnumRow = { k: 'enum'; family: KnobFamily; field: string; label: string; options: { value: string; label: string }[] }
type ColorRow = { k: 'color'; family: KnobFamily; field: string; label: string; fallback: string }
type Row = KnobRow | BoolRow | EnumRow | ColorRow

// ── Helpers ────────────────────────────────────────────────────────────────

const SCHEMA_RESERVED = new Set<KnobFamily>(['mat', 'type', 'motion'])

const famOf = (vals: KnobValues, f: KnobFamily): AnyFam =>
  (vals as unknown as Record<KnobFamily, AnyFam>)[f]

function isSiteFamilyEdited(site: KnobValues, family: KnobFamily): boolean {
  return JSON.stringify(site[family]) !== JSON.stringify(DEFAULT_KNOB_VALUES[family])
}

function detectCircPreset(circ: KnobValues['circ']): CircadianPreset {
  for (const [name, preset] of Object.entries(CIRCADIAN_PRESETS) as [CircadianPreset, typeof CIRCADIAN_PRESETS[CircadianPreset]][]) {
    if (name === 'custom') continue
    if (
      circ.auto === preset.auto &&
      circ.drives.light === preset.drives.light &&
      circ.drives.shadow === preset.drives.shadow &&
      circ.drives.bg === preset.drives.bg &&
      circ.drives.atm === preset.drives.atm
    ) return name
  }
  return 'custom'
}

function minutesToTimeStr(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ── Shared style tokens ────────────────────────────────────────────────────

const familyHeaderBtn: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  background: 'none', border: 'none', cursor: 'pointer', color: 'inherit',
  padding: '6px 0', textAlign: 'left',
}
const segmentedGroup: CSSProperties = { display: 'inline-flex', border: '1px solid var(--bd)', borderRadius: 4, overflow: 'hidden' }
function segBtn(active: boolean): CSSProperties {
  return { padding: '3px 7px', minHeight: 22, fontSize: 8, letterSpacing: 1, fontFamily: 'inherit', textTransform: 'uppercase', border: 'none', cursor: 'pointer', background: active ? 'var(--ac)' : 'var(--bg1)', color: active ? '#fff' : 'var(--tx2)' }
}
const checkRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, fontSize: 9, marginBottom: 10, cursor: 'pointer', color: 'var(--tx2)' }
const cellCenter: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3px 0' }

// ── Main component ─────────────────────────────────────────────────────────

interface KnobsPanelProps {
  knobs: KnobsConfig
  onChange: (next: KnobsConfig) => void
  selectedBlockUid?: string
  selectedBlockOverride?: KnobFamilyOverrides
  onBlockOverrideChange?: (override: KnobFamilyOverrides) => void
}

export function KnobsPanel({
  knobs,
  onChange,
  selectedBlockUid,
  selectedBlockOverride,
  onBlockOverrideChange,
}: KnobsPanelProps) {
  const { t } = useI18n()

  const blockOverride: KnobFamilyOverrides = selectedBlockOverride ?? {}

  const [circCollapsed, setCircCollapsed] = useState(true)
  const [a11yCollapsed, setA11yCollapsed] = useState(true)

  // ── Effective values per column scope (site is the base) ───────────────
  const scopeVals: Record<Scope, KnobValues> = {
    site:    knobs.site,
    landing: mergeKnobFamilies(knobs.site, knobs.pages.landing ?? {}),
    works:   mergeKnobFamilies(knobs.site, knobs.pages.works ?? {}),
    about:   mergeKnobFamilies(knobs.site, knobs.pages.about ?? {}),
    block:   mergeKnobFamilies(knobs.site, blockOverride),
  }

  const COLS: { scope: Scope; label: string }[] = [
    { scope: 'site',    label: t('site_knobs_scope_site') },
    { scope: 'landing', label: t('site_knobs_scope_landing') },
    { scope: 'works',   label: t('site_knobs_scope_works') },
    { scope: 'about',   label: t('site_knobs_scope_about') },
    ...(selectedBlockUid ? [{ scope: 'block' as Scope, label: t('site_knobs_scope_block') }] : []),
  ]

  // ── Generic field write (site = base; page/block = override, auto-clear) ─
  function setField(scope: Scope, family: KnobFamily, patch: AnyFam) {
    const baseFam = famOf(knobs.site, family)
    if (scope === 'site') {
      const nextFam = { ...baseFam, ...patch }
      onChange({ ...knobs, site: { ...knobs.site, [family]: nextFam } as unknown as KnobValues })
      return
    }
    if (scope === 'block') {
      const cur = (blockOverride as unknown as Record<KnobFamily, AnyFam | undefined>)[family] ?? baseFam
      const fam = { ...cur, ...patch }
      const next: KnobFamilyOverrides = { ...blockOverride }
      if (JSON.stringify(fam) === JSON.stringify(baseFam)) delete (next as Record<string, unknown>)[family]
      else (next as unknown as Record<KnobFamily, AnyFam>)[family] = fam
      onBlockOverrideChange?.(next)
      return
    }
    const page = scope as PageScope
    const ov = knobs.pages[page] ?? {}
    const cur = (ov as unknown as Record<KnobFamily, AnyFam | undefined>)[family] ?? baseFam
    const fam = { ...cur, ...patch }
    const nextOv: KnobFamilyOverrides = { ...ov }
    if (JSON.stringify(fam) === JSON.stringify(baseFam)) delete (nextOv as Record<string, unknown>)[family]
    else (nextOv as unknown as Record<KnobFamily, AnyFam>)[family] = fam
    onChange({ ...knobs, pages: { ...knobs.pages, [page]: nextOv } })
  }

  function isOverridden(scope: Scope, family: KnobFamily): boolean {
    if (scope === 'site') return isSiteFamilyEdited(knobs.site, family)
    if (scope === 'block') return family in blockOverride
    return family in (knobs.pages[scope as PageScope] ?? {})
  }

  function overrideCount(scope: Scope): number {
    if (scope === 'block') return Object.keys(blockOverride).length
    if (scope === 'site') return 0
    return Object.keys(knobs.pages[scope as PageScope] ?? {}).length
  }

  function revertScope(scope: Scope) {
    if (scope === 'block') { onBlockOverrideChange?.({}); return }
    if (scope === 'site') return
    onChange({ ...knobs, pages: { ...knobs.pages, [scope as PageScope]: {} } })
  }

  // ── Row definitions (one row per setting, grouped by family) ────────────

  const GROUPS: { family: KnobFamily; label: string; rows: Row[] }[] = [
    { family: 'light', label: t('site_knobs_family_light'), rows: [
      { k: 'knob', family: 'light', field: 'temp_k', label: t('site_knobs_light_temp'), min: WORKS_LIGHT_TEMP_MIN, max: WORKS_LIGHT_TEMP_MAX, step: 100, unit: 'K' },
      { k: 'knob', family: 'light', field: 'direction_deg', label: t('site_knobs_light_dir'), min: 0, max: 360, step: 5, unit: '°' },
      { k: 'knob', family: 'light', field: 'intensity_pct', label: t('site_knobs_light_intensity'), min: WORKS_LIGHT_INTENSITY_MIN, max: WORKS_LIGHT_INTENSITY_MAX, step: 5, unit: '%' },
    ] },
    { family: 'shadow', label: t('site_knobs_family_shadow'), rows: [
      { k: 'bool', family: 'shadow', field: 'enabled', label: t('site_knobs_shadow_enabled') },
      { k: 'knob', family: 'shadow', field: 'distance_px', label: t('site_knobs_shadow_distance'), min: WORKS_CAST_SHADOW_DISTANCE_MIN, max: WORKS_CAST_SHADOW_DISTANCE_MAX, step: 1, unit: 'px' },
      { k: 'knob', family: 'shadow', field: 'blur_px', label: t('site_knobs_shadow_blur'), min: WORKS_CAST_SHADOW_BLUR_MIN, max: WORKS_CAST_SHADOW_BLUR_MAX, step: 1, unit: 'px' },
      { k: 'knob', family: 'shadow', field: 'opacity_pct', label: t('site_knobs_shadow_opacity'), min: 0, max: 100, step: 1, unit: '%' },
    ] },
    { family: 'frame', label: t('site_knobs_family_frame'), rows: [
      { k: 'knob', family: 'frame', field: 'bevel_px', label: t('site_knobs_frame_bevel'), min: 0, max: LANDING_HERO_BEVEL_PX_MAX, step: 1, unit: 'px' },
      { k: 'enum', family: 'frame', field: 'bevel_profile', label: t('site_knobs_family_frame'), options: LANDING_HERO_BEVEL_PROFILE_VALUES.map(p => ({ value: p, label: p === 'smooth' ? t('site_knobs_frame_smooth') : t('site_knobs_frame_hard') })) },
    ] },
    { family: 'bg', label: t('site_knobs_family_bg'), rows: [
      { k: 'knob', family: 'bg', field: 'blend_position', label: t('site_knobs_bg_blend_pos'), min: 0, max: 100, step: 1, unit: '%' },
      { k: 'knob', family: 'bg', field: 'blend_softness', label: t('site_knobs_bg_blend_soft'), min: 0, max: 100, step: 1, unit: '%' },
      { k: 'knob', family: 'bg', field: 'opacity', label: t('site_knobs_bg_opacity'), min: 0, max: 100, step: 1, unit: '%', mul: 100 },
    ] },
    { family: 'atm', label: t('site_knobs_family_atm'), rows: [
      { k: 'color', family: 'atm', field: 'sky_top', label: t('site_knobs_atm_sky_top'), fallback: '#0a0c12' },
      { k: 'color', family: 'atm', field: 'sky_bottom', label: t('site_knobs_atm_sky_bottom'), fallback: '#1a1c24' },
      { k: 'knob', family: 'atm', field: 'tint_opacity', label: t('site_knobs_atm_tint_opacity'), min: 0, max: 100, step: 1, unit: '%', mul: 100 },
      { k: 'knob', family: 'atm', field: 'work_glow_pct', label: t('site_knobs_atm_work_glow'), min: 0, max: 100, step: 1, unit: '%' },
    ] },
    { family: 'mat', label: t('site_knobs_family_mat'), rows: [
      { k: 'knob', family: 'mat', field: 'grain_pct', label: t('site_knobs_mat_grain'), min: 0, max: 100, step: 1, unit: '%' },
      { k: 'knob', family: 'mat', field: 'voile_pct', label: t('site_knobs_mat_voile'), min: 0, max: 100, step: 1, unit: '%' },
      { k: 'knob', family: 'mat', field: 'vignette_pct', label: t('site_knobs_mat_vignette'), min: 0, max: 100, step: 1, unit: '%' },
    ] },
    { family: 'type', label: t('site_knobs_family_type'), rows: [
      { k: 'knob', family: 'type', field: 'scale_pct', label: t('site_knobs_type_scale'), min: 75, max: 200, step: 25, unit: '%' },
      { k: 'enum', family: 'type', field: 'weight', label: t('site_knobs_family_type'), options: [
        { value: 'light', label: t('site_knobs_type_light') },
        { value: 'regular', label: t('site_knobs_type_regular') },
        { value: 'bold', label: t('site_knobs_type_bold') },
      ] },
    ] },
    { family: 'motion', label: t('site_knobs_family_motion'), rows: [
      { k: 'knob', family: 'motion', field: 'parallax_mult', label: t('site_knobs_motion_parallax'), min: 0, max: 3, step: 0.25 },
      { k: 'knob', family: 'motion', field: 'sway_speed_mult', label: t('site_knobs_motion_sway'), min: 0, max: 3, step: 0.25 },
      { k: 'bool', family: 'motion', field: 'reduce_motion', label: t('site_knobs_motion_reduce') },
    ] },
  ]

  // ── One control cell ───────────────────────────────────────────────────

  function ControlCell({ row, scope }: { row: Row; scope: Scope }) {
    const fam = famOf(scopeVals[scope], row.family)
    const anchorFam = famOf(scope === 'site' ? DEFAULT_KNOB_VALUES : knobs.site, row.family)
    // Shadow distance/blur/opacity follow the per-scope enabled flag.
    const shadowOff = row.family === 'shadow' && row.field !== 'enabled' && fam.enabled === false

    if (row.k === 'knob') {
      const mul = row.mul ?? 1
      const value = Math.round(Number(fam[row.field] ?? 0) * mul)
      const anchor = Math.round(Number(anchorFam[row.field] ?? 0) * mul)
      return (
        <div style={cellCenter}>
          <Knob
            showLabel={false}
            size={36}
            label={`${row.label} · ${scope}`}
            min={row.min} max={row.max} step={row.step ?? 1} unit={row.unit}
            value={value}
            disabled={shadowOff}
            defaultValue={anchor}
            onChange={d => setField(scope, row.family, { [row.field]: mul === 1 ? d : d / mul })}
          />
        </div>
      )
    }
    if (row.k === 'bool') {
      return (
        <div style={cellCenter}>
          <input
            type="checkbox"
            checked={Boolean(fam[row.field])}
            aria-label={`${row.label} · ${scope}`}
            onChange={e => setField(scope, row.family, { [row.field]: e.target.checked })}
            style={{ margin: 0, width: 16, height: 16 }}
          />
        </div>
      )
    }
    if (row.k === 'enum') {
      return (
        <div style={cellCenter}>
          <select
            value={String(fam[row.field])}
            aria-label={`${row.label} · ${scope}`}
            disabled={shadowOff}
            onChange={e => setField(scope, row.family, { [row.field]: e.target.value })}
            style={{ fontFamily: 'inherit', fontSize: 8, padding: '2px 4px', background: 'var(--bg2)', color: 'var(--tx)', border: '1px solid var(--bd2)', borderRadius: 2, maxWidth: '100%' }}
          >
            {row.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )
    }
    // color
    return (
      <div style={cellCenter}>
        <input
          type="color"
          value={normalizeHexColor(String(fam[row.field])) ?? row.fallback}
          aria-label={`${row.label} · ${scope}`}
          onChange={e => setField(scope, row.family, { [row.field]: e.target.value })}
          style={{ width: 28, height: 24, padding: 0, border: '1px solid var(--bd)', borderRadius: 2, cursor: 'pointer', background: 'none' }}
        />
      </div>
    )
  }

  const gridCols = `minmax(108px, 1.4fr) repeat(${COLS.length}, minmax(56px, 1fr))`

  // ── CIRCADIAN section ─────────────────────────────────────────────────

  function CircadianSection() {
    const circ = knobs.site.circ
    const activePreset = detectCircPreset(circ)
    function applyPreset(name: CircadianPreset) {
      const p = CIRCADIAN_PRESETS[name]
      onChange({ ...knobs, site: { ...knobs.site, circ: { ...circ, auto: p.auto, drives: { ...p.drives } } } })
    }
    function patchCirc(update: Partial<KnobValues['circ']>) {
      onChange({ ...knobs, site: { ...knobs.site, circ: { ...circ, ...update } } })
    }
    return (
      <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 6, paddingBottom: circCollapsed ? 0 : 12 }}>
        <button type="button" style={{ ...familyHeaderBtn, marginBottom: circCollapsed ? 0 : 8 }} onClick={() => setCircCollapsed(v => !v)}>
          <span style={{ fontSize: 8, color: 'var(--tx3)' }}>{circCollapsed ? '▸' : '▾'}</span>
          <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx2)' }}>{t('site_knobs_circ_section')}</span>
          {(circ.auto || circ.drives.light || circ.drives.shadow || circ.drives.bg || circ.drives.atm) && (
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ac)', display: 'inline-block', flexShrink: 0 }} />
          )}
        </button>
        {!circCollapsed && (
          <>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
              {(['sun', 'gallery', 'theatre', 'custom'] as CircadianPreset[]).map(name => (
                <button key={name} type="button" className="t-mono-xs" onClick={() => applyPreset(name)}
                  style={{ padding: '4px 9px', fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', border: '1px solid var(--bd)', borderRadius: 4, cursor: 'pointer', background: activePreset === name ? 'var(--ac)' : 'var(--bg1)', color: activePreset === name ? '#fff' : 'var(--tx2)', fontFamily: 'inherit' }}>
                  {name === 'sun' ? t('site_knobs_circ_preset_sun') : name === 'gallery' ? t('site_knobs_circ_preset_gallery') : name === 'theatre' ? t('site_knobs_circ_preset_theatre') : t('site_knobs_circ_preset_custom')}
                </button>
              ))}
            </div>
            <label style={checkRowStyle}>
              <input type="checkbox" checked={circ.auto} onChange={e => patchCirc({ auto: e.target.checked })} />
              {t('site_knobs_circ_auto')}
            </label>
            {!circ.auto && (
              <div style={{ marginBottom: 10 }}>
                <Slider label={t('site_knobs_circ_manual')} min={0} max={1439} step={1} value={circ.manual_minute}
                  onChange={v => patchCirc({ manual_minute: v })} unit={` (${minutesToTimeStr(circ.manual_minute)})`}
                  defaultValue={720} onReset={() => patchCirc({ manual_minute: 720 })} />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 6 }}>
              {([
                ['light', t('site_knobs_circ_drive_light')],
                ['shadow', t('site_knobs_circ_drive_shadow')],
                ['bg', t('site_knobs_circ_drive_bg')],
                ['atm', t('site_knobs_circ_drive_atm')],
              ] as const).map(([key, label]) => (
                <label key={key} style={{ ...checkRowStyle, marginBottom: 4 }}>
                  <input type="checkbox" checked={circ.drives[key]} onChange={e => patchCirc({ drives: { ...circ.drives, [key]: e.target.checked } })} />
                  {label}
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // ── A11Y section ──────────────────────────────────────────────────────

  function A11ySection() {
    const a = knobs.site.a11y
    const isDirty = a.type_size_step !== DEFAULT_KNOB_VALUES.a11y.type_size_step || a.high_contrast !== DEFAULT_KNOB_VALUES.a11y.high_contrast
    function patchA11y(update: Partial<KnobValues['a11y']>) {
      onChange({ ...knobs, site: { ...knobs.site, a11y: { ...a, ...update } } })
    }
    const STEPS = [
      { value: 1, label: t('site_knobs_a11y_step_1') },
      { value: 1.25, label: t('site_knobs_a11y_step_125') },
      { value: 1.5, label: t('site_knobs_a11y_step_150') },
      { value: 2, label: t('site_knobs_a11y_step_200') },
    ]
    return (
      <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 6, paddingBottom: a11yCollapsed ? 0 : 12 }}>
        <button type="button" style={{ ...familyHeaderBtn, marginBottom: a11yCollapsed ? 0 : 8 }} onClick={() => setA11yCollapsed(v => !v)}>
          <span style={{ fontSize: 8, color: 'var(--tx3)' }}>{a11yCollapsed ? '▸' : '▾'}</span>
          <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx2)' }}>{t('site_knobs_a11y_section')}</span>
          {isDirty && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ac)', display: 'inline-block', flexShrink: 0 }} />}
        </button>
        {!a11yCollapsed && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ color: 'var(--tx2)', fontSize: 9, minWidth: 120 }}>{t('site_knobs_a11y_type_size')}</span>
              <div style={segmentedGroup}>
                {STEPS.map(({ value, label }) => (
                  <button key={value} type="button" className="t-mono-xs" onClick={() => patchA11y({ type_size_step: value })} style={segBtn(a.type_size_step === value)}>{label}</button>
                ))}
              </div>
            </div>
            <label style={checkRowStyle}>
              <input type="checkbox" checked={a.high_contrast} onChange={e => patchA11y({ high_contrast: e.target.checked })} />
              {t('site_knobs_a11y_high_contrast')}
            </label>
          </>
        )}
      </div>
    )
  }

  // ── Render — mixing desk ───────────────────────────────────────────────

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center', columnGap: 6 }}>
        {/* Header row: page columns */}
        <div />
        {COLS.map(({ scope, label }) => {
          const n = overrideCount(scope)
          return (
            <div key={scope} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '0 0 6px' }}>
              <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: scope === 'site' ? 'var(--tx)' : 'var(--tx2)', fontWeight: scope === 'site' ? 600 : 400 }}>{label}</span>
              {scope !== 'site' && (
                n > 0 ? (
                  <button type="button" onClick={() => revertScope(scope)} title={t('site_knobs_override_on')}
                    style={{ fontSize: 7, letterSpacing: 0.5, textTransform: 'uppercase', border: 'none', background: 'none', color: 'var(--ac)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--ac)' }} />↺ {n}
                  </button>
                ) : (
                  <span style={{ fontSize: 7, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--tx3)', opacity: 0.6 }}>{t('site_knobs_override_inherited')}</span>
                )
              )}
            </div>
          )
        })}

        {/* Family groups: header spanning all columns, then one row per setting */}
        {GROUPS.map(group => (
          <div key={group.family} style={{ display: 'contents' }}>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--bd)', padding: '7px 0 3px' }}>
              <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx2)' }}>{group.label}</span>
              {SCHEMA_RESERVED.has(group.family) && (
                <span style={{ fontSize: 8, opacity: 0.45 }}>{t('site_knobs_not_rendered_note')}</span>
              )}
            </div>
            {group.rows.map(row => (
              <div key={row.field} style={{ display: 'contents' }}>
                <div style={{ fontSize: 9, color: 'var(--tx2)', paddingLeft: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.label}>
                  {row.label}
                </div>
                {COLS.map(({ scope }) => (
                  <ControlCell key={scope} row={row} scope={scope} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Circadian + accessibility (site-wide) */}
      <div style={{ marginTop: 14 }}>
        <CircadianSection />
        <A11ySection />
      </div>
    </div>
  )
}
