'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Slider } from '@/components/atelier/portfolio/shared/Slider'
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

// ── Helpers ────────────────────────────────────────────────────────────────

const ALL_FAMILIES: KnobFamily[] = [
  'light', 'shadow', 'frame', 'bg', 'atm', 'mat', 'type', 'motion',
]

const SCHEMA_RESERVED: Set<KnobFamily> = new Set<KnobFamily>(['mat', 'type', 'motion'])

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

const familyHeaderBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'inherit',
  padding: '6px 0',
  textAlign: 'left',
}

const segmentedGroup: React.CSSProperties = {
  display: 'inline-flex',
  border: '1px solid var(--bd)',
  borderRadius: 4,
  overflow: 'hidden',
}

function segBtn(active: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    minHeight: 26,
    fontSize: 9,
    letterSpacing: 1,
    fontFamily: 'inherit',
    textTransform: 'uppercase',
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--ac)' : 'var(--bg1)',
    color: active ? '#fff' : 'var(--tx2)',
  }
}

const colorInputStyle: React.CSSProperties = {
  width: 40,
  height: 26,
  padding: 0,
  border: '1px solid var(--bd)',
  cursor: 'pointer',
  borderRadius: 2,
}

const checkRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 9,
  marginBottom: 10,
  cursor: 'pointer',
  color: 'var(--tx2)',
}

// ── Main component ─────────────────────────────────────────────────────────

interface KnobsPanelProps {
  knobs: KnobsConfig
  onChange: (next: KnobsConfig) => void
  /** UID of the currently selected block — enables the block scope tab. */
  selectedBlockUid?: string
  /** Current knob_override for the selected block (read from Block.knob_override). */
  selectedBlockOverride?: KnobFamilyOverrides
  /** Called when the block's knob_override should change (block scope edits). */
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

  // ── Scope state ────────────────────────────────────────────────────────

  const [scope, setScope] = useState<Scope>('site')
  const isSiteScope = scope === 'site'
  const isBlockScope = scope === 'block'
  const pageKey = scope as PageScope

  const pageOverrides: KnobFamilyOverrides =
    isSiteScope || isBlockScope ? {} : (knobs.pages[pageKey] ?? {})
  const blockOverride: KnobFamilyOverrides = selectedBlockOverride ?? {}

  /** Values displayed by family controls — merged site + page + block overrides. */
  const displayValues: KnobValues = isBlockScope
    ? mergeKnobFamilies(knobs.site, blockOverride)
    : isSiteScope
      ? knobs.site
      : mergeKnobFamilies(knobs.site, pageOverrides)

  /**
   * Reset anchor: site = absolute defaults; page = site values; block = site values.
   * (↺ chip appears when value differs from reset anchor.)
   */
  const resetValues = isSiteScope ? DEFAULT_KNOB_VALUES : knobs.site

  const [collapsed, setCollapsed] = useState<Set<KnobFamily>>(
    () => new Set<KnobFamily>([...SCHEMA_RESERVED, 'atm']),
  )
  const [circCollapsed, setCircCollapsed] = useState(true)
  const [a11yCollapsed, setA11yCollapsed] = useState(true)

  // ── Patch helpers ─────────────────────────────────────────────────────

  function patch(update: Partial<KnobValues>) {
    if (isSiteScope) {
      onChange({ ...knobs, site: { ...knobs.site, ...update } })
    } else if (isBlockScope) {
      onBlockOverrideChange?.({ ...blockOverride, ...update })
    } else {
      onChange({
        ...knobs,
        pages: { ...knobs.pages, [pageKey]: { ...pageOverrides, ...update } },
      })
    }
  }

  function patchCirc(update: Partial<KnobValues['circ']>) {
    onChange({ ...knobs, site: { ...knobs.site, circ: { ...knobs.site.circ, ...update } } })
  }

  function patchA11y(update: Partial<KnobValues['a11y']>) {
    onChange({ ...knobs, site: { ...knobs.site, a11y: { ...knobs.site.a11y, ...update } } })
  }

  function isOverrideEnabled(family: KnobFamily): boolean {
    if (isSiteScope) return true
    if (isBlockScope) return family in blockOverride
    return family in pageOverrides
  }

  function toggleOverride(family: KnobFamily) {
    if (isSiteScope) return
    if (isBlockScope) {
      if (family in blockOverride) {
        const next = Object.fromEntries(
          Object.entries(blockOverride).filter(([k]) => k !== family),
        ) as KnobFamilyOverrides
        onBlockOverrideChange?.(next)
      } else {
        onBlockOverrideChange?.({ ...blockOverride, [family]: { ...knobs.site[family] } })
      }
      return
    }
    if (family in pageOverrides) {
      const next = Object.fromEntries(
        Object.entries(pageOverrides).filter(([k]) => k !== family),
      ) as KnobFamilyOverrides
      onChange({ ...knobs, pages: { ...knobs.pages, [pageKey]: next } })
    } else {
      onChange({
        ...knobs,
        pages: {
          ...knobs.pages,
          [pageKey]: { ...pageOverrides, [family]: { ...knobs.site[family] } },
        },
      })
    }
  }

  function toggleFamily(f: KnobFamily) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })
  }

  // ── Family section header ────────────────────────────────────────────

  function FamilyHead({ family, label }: { family: KnobFamily; label: string }) {
    const edited = isSiteScope
      ? isSiteFamilyEdited(knobs.site, family)
      : isBlockScope
        ? family in blockOverride
        : family in pageOverrides
    const open = !collapsed.has(family)
    const overrideOn = isOverrideEnabled(family)

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          style={{ ...familyHeaderBtn, flex: 1, marginBottom: open ? 8 : 0 }}
          onClick={() => toggleFamily(family)}
        >
          <span style={{ fontSize: 8, color: 'var(--tx3)' }}>{open ? '▾' : '▸'}</span>
          <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx2)' }}>
            {label}
          </span>
          {edited && (
            <span
              style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'var(--ac)', display: 'inline-block', flexShrink: 0,
              }}
              title={t('site_knobs_reset_family')}
            />
          )}
          {SCHEMA_RESERVED.has(family) && (
            <span style={{ fontSize: 8, opacity: 0.45, marginLeft: 'auto' }}>
              {t('site_knobs_not_rendered_note')}
            </span>
          )}
        </button>
        {!isSiteScope && (
          <label
            style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', flexShrink: 0 }}
            title={overrideOn ? t('site_knobs_override_on') : t('site_knobs_override_inherited')}
          >
            <input
              type="checkbox"
              checked={overrideOn}
              onChange={() => toggleOverride(family)}
              style={{ margin: 0 }}
            />
            <span style={{ fontSize: 8, color: overrideOn ? 'var(--ac)' : 'var(--tx3)', letterSpacing: 0.5 }}>
              {overrideOn ? t('site_knobs_override_on') : t('site_knobs_override_inherited')}
            </span>
          </label>
        )}
      </div>
    )
  }

  // ── LIGHT ────────────────────────────────────────────────────────────

  function LightFamily() {
    const l = displayValues.light
    const rl = resetValues.light
    return (
      <>
        <Slider
          label={t('site_knobs_light_temp')}
          min={WORKS_LIGHT_TEMP_MIN} max={WORKS_LIGHT_TEMP_MAX} step={100}
          value={l.temp_k}
          onChange={v => patch({ light: { ...l, temp_k: v } })}
          unit="K"
          defaultValue={rl.temp_k}
          onReset={() => patch({ light: { ...l, temp_k: rl.temp_k } })}
        />
        <Slider
          label={t('site_knobs_light_dir')}
          min={0} max={360} step={5}
          value={l.direction_deg}
          onChange={v => patch({ light: { ...l, direction_deg: v } })}
          unit="°"
          defaultValue={rl.direction_deg}
          onReset={() => patch({ light: { ...l, direction_deg: rl.direction_deg } })}
        />
        <Slider
          label={t('site_knobs_light_intensity')}
          min={WORKS_LIGHT_INTENSITY_MIN} max={WORKS_LIGHT_INTENSITY_MAX} step={5}
          value={l.intensity_pct}
          onChange={v => patch({ light: { ...l, intensity_pct: v } })}
          unit="%"
          defaultValue={rl.intensity_pct}
          onReset={() => patch({ light: { ...l, intensity_pct: rl.intensity_pct } })}
        />
      </>
    )
  }

  // ── SHADOW ───────────────────────────────────────────────────────────

  function ShadowFamily() {
    const s = displayValues.shadow
    const rs = resetValues.shadow
    return (
      <>
        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={s.enabled}
            onChange={e => patch({ shadow: { ...s, enabled: e.target.checked } })}
          />
          {t('site_knobs_shadow_enabled')}
        </label>
        <div style={{ opacity: s.enabled ? 1 : 0.4, pointerEvents: s.enabled ? 'auto' : 'none' }}>
          <Slider
            label={t('site_knobs_shadow_distance')}
            min={WORKS_CAST_SHADOW_DISTANCE_MIN} max={WORKS_CAST_SHADOW_DISTANCE_MAX} step={1}
            value={s.distance_px}
            onChange={v => patch({ shadow: { ...s, distance_px: v } })}
            unit="px"
            defaultValue={rs.distance_px}
            onReset={() => patch({ shadow: { ...s, distance_px: rs.distance_px } })}
          />
          <Slider
            label={t('site_knobs_shadow_blur')}
            min={WORKS_CAST_SHADOW_BLUR_MIN} max={WORKS_CAST_SHADOW_BLUR_MAX} step={1}
            value={s.blur_px}
            onChange={v => patch({ shadow: { ...s, blur_px: v } })}
            unit="px"
            defaultValue={rs.blur_px}
            onReset={() => patch({ shadow: { ...s, blur_px: rs.blur_px } })}
          />
          <Slider
            label={t('site_knobs_shadow_opacity')}
            min={0} max={100} step={1}
            value={s.opacity_pct}
            onChange={v => patch({ shadow: { ...s, opacity_pct: v } })}
            unit="%"
            defaultValue={rs.opacity_pct}
            onReset={() => patch({ shadow: { ...s, opacity_pct: rs.opacity_pct } })}
          />
        </div>
      </>
    )
  }

  // ── FRAME ────────────────────────────────────────────────────────────

  function FrameFamily() {
    const f = displayValues.frame
    const rf = resetValues.frame
    return (
      <>
        <Slider
          label={t('site_knobs_frame_bevel')}
          min={0} max={LANDING_HERO_BEVEL_PX_MAX} step={1}
          value={f.bevel_px}
          onChange={v => patch({ frame: { ...f, bevel_px: v } })}
          unit="px"
          defaultValue={rf.bevel_px}
          onReset={() => patch({ frame: { ...f, bevel_px: rf.bevel_px } })}
          mb={10}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ color: 'var(--tx2)', fontSize: 9, minWidth: 120 }} />
          <div style={segmentedGroup}>
            {LANDING_HERO_BEVEL_PROFILE_VALUES.map(p => (
              <button
                key={p}
                type="button"
                className="t-mono-xs"
                onClick={() => patch({ frame: { ...f, bevel_profile: p } })}
                style={segBtn(f.bevel_profile === p)}
              >
                {p === 'smooth' ? t('site_knobs_frame_smooth') : t('site_knobs_frame_hard')}
              </button>
            ))}
          </div>
        </div>
      </>
    )
  }

  // ── BACKGROUND ───────────────────────────────────────────────────────

  function BgFamily() {
    const bg = displayValues.bg
    const rbg = resetValues.bg
    return (
      <>
        <Slider
          label={t('site_knobs_bg_blend_pos')}
          min={0} max={100} step={1}
          value={bg.blend_position}
          onChange={v => patch({ bg: { ...bg, blend_position: v } })}
          unit="%"
          defaultValue={rbg.blend_position}
          onReset={() => patch({ bg: { ...bg, blend_position: rbg.blend_position } })}
        />
        <Slider
          label={t('site_knobs_bg_blend_soft')}
          min={0} max={100} step={1}
          value={bg.blend_softness}
          onChange={v => patch({ bg: { ...bg, blend_softness: v } })}
          unit="%"
          defaultValue={rbg.blend_softness}
          onReset={() => patch({ bg: { ...bg, blend_softness: rbg.blend_softness } })}
        />
        <Slider
          label={t('site_knobs_bg_opacity')}
          min={0} max={100} step={1}
          value={Math.round(bg.opacity * 100)}
          onChange={v => patch({ bg: { ...bg, opacity: v / 100 } })}
          unit="%"
          defaultValue={Math.round(rbg.opacity * 100)}
          onReset={() => patch({ bg: { ...bg, opacity: rbg.opacity } })}
        />
      </>
    )
  }

  // ── ATMOSPHERE ────────────────────────────────────────────────────────

  function AtmFamily() {
    const a = displayValues.atm
    const ra = resetValues.atm
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, fontSize: 9, marginBottom: 6, alignItems: 'center' }}>
          <span style={{ color: 'var(--tx2)' }}>{t('site_knobs_atm_sky_top')}</span>
          <input
            type="color"
            value={normalizeHexColor(a.sky_top) ?? '#0a0c12'}
            onChange={e => patch({ atm: { ...a, sky_top: e.target.value } })}
            aria-label={t('site_knobs_atm_sky_top')}
            style={colorInputStyle}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, fontSize: 9, marginBottom: 10, alignItems: 'center' }}>
          <span style={{ color: 'var(--tx2)' }}>{t('site_knobs_atm_sky_bottom')}</span>
          <input
            type="color"
            value={normalizeHexColor(a.sky_bottom) ?? '#1a1c24'}
            onChange={e => patch({ atm: { ...a, sky_bottom: e.target.value } })}
            aria-label={t('site_knobs_atm_sky_bottom')}
            style={colorInputStyle}
          />
        </div>
        <Slider
          label={t('site_knobs_atm_tint_opacity')}
          min={0} max={100} step={1}
          value={Math.round(a.tint_opacity * 100)}
          onChange={v => patch({ atm: { ...a, tint_opacity: v / 100 } })}
          unit="%"
          defaultValue={Math.round(ra.tint_opacity * 100)}
          onReset={() => patch({ atm: { ...a, tint_opacity: ra.tint_opacity } })}
        />
        <Slider
          label={t('site_knobs_atm_work_glow')}
          min={0} max={100} step={1}
          value={a.work_glow_pct}
          onChange={v => patch({ atm: { ...a, work_glow_pct: v } })}
          unit="%"
          defaultValue={ra.work_glow_pct}
          onReset={() => patch({ atm: { ...a, work_glow_pct: ra.work_glow_pct } })}
        />
      </>
    )
  }

  // ── SURFACE TEXTURE ───────────────────────────────────────────────────

  function MatFamily() {
    const m = displayValues.mat
    const rm = resetValues.mat
    return (
      <>
        <Slider label={t('site_knobs_mat_grain')} min={0} max={100} value={m.grain_pct}
          onChange={v => patch({ mat: { ...m, grain_pct: v } })}
          unit="%" defaultValue={rm.grain_pct}
          onReset={() => patch({ mat: { ...m, grain_pct: rm.grain_pct } })} />
        <Slider label={t('site_knobs_mat_voile')} min={0} max={100} value={m.voile_pct}
          onChange={v => patch({ mat: { ...m, voile_pct: v } })}
          unit="%" defaultValue={rm.voile_pct}
          onReset={() => patch({ mat: { ...m, voile_pct: rm.voile_pct } })} />
        <Slider label={t('site_knobs_mat_vignette')} min={0} max={100} value={m.vignette_pct}
          onChange={v => patch({ mat: { ...m, vignette_pct: v } })}
          unit="%" defaultValue={rm.vignette_pct}
          onReset={() => patch({ mat: { ...m, vignette_pct: rm.vignette_pct } })} />
      </>
    )
  }

  // ── TYPOGRAPHY ────────────────────────────────────────────────────────

  function TypeFamily() {
    const ty = displayValues.type
    const rty = resetValues.type
    return (
      <>
        <Slider label={t('site_knobs_type_scale')} min={75} max={200} step={25} value={ty.scale_pct}
          onChange={v => patch({ type: { ...ty, scale_pct: v } })}
          unit="%" defaultValue={rty.scale_pct}
          onReset={() => patch({ type: { ...ty, scale_pct: rty.scale_pct } })}
          mb={10} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={segmentedGroup}>
            {(['light', 'regular', 'bold'] as const).map(w => (
              <button key={w} type="button" className="t-mono-xs"
                onClick={() => patch({ type: { ...ty, weight: w } })}
                style={segBtn(ty.weight === w)}>
                {w === 'light' ? t('site_knobs_type_light')
                  : w === 'bold' ? t('site_knobs_type_bold')
                  : t('site_knobs_type_regular')}
              </button>
            ))}
          </div>
        </div>
      </>
    )
  }

  // ── MOTION ────────────────────────────────────────────────────────────

  function MotionFamily() {
    const mo = displayValues.motion
    const rmo = resetValues.motion
    return (
      <>
        <Slider label={t('site_knobs_motion_parallax')} min={0} max={3} step={0.25}
          value={mo.parallax_mult}
          onChange={v => patch({ motion: { ...mo, parallax_mult: v } })}
          defaultValue={rmo.parallax_mult}
          onReset={() => patch({ motion: { ...mo, parallax_mult: rmo.parallax_mult } })}
          mb={6} />
        <Slider label={t('site_knobs_motion_sway')} min={0} max={3} step={0.25}
          value={mo.sway_speed_mult}
          onChange={v => patch({ motion: { ...mo, sway_speed_mult: v } })}
          defaultValue={rmo.sway_speed_mult}
          onReset={() => patch({ motion: { ...mo, sway_speed_mult: rmo.sway_speed_mult } })}
          mb={10} />
        <label style={checkRowStyle}>
          <input type="checkbox"
            checked={mo.reduce_motion}
            onChange={e => patch({ motion: { ...mo, reduce_motion: e.target.checked } })} />
          {t('site_knobs_motion_reduce')}
        </label>
      </>
    )
  }

  // ── CIRCADIAN section ─────────────────────────────────────────────────

  function CircadianSection() {
    const circ = knobs.site.circ
    const activePreset = detectCircPreset(circ)

    function applyPreset(name: CircadianPreset) {
      const p = CIRCADIAN_PRESETS[name]
      patchCirc({ auto: p.auto, drives: { ...p.drives } })
    }

    return (
      <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 6, paddingBottom: circCollapsed ? 0 : 12 }}>
        <button
          type="button"
          style={{ ...familyHeaderBtn, marginBottom: circCollapsed ? 0 : 8 }}
          onClick={() => setCircCollapsed(v => !v)}
        >
          <span style={{ fontSize: 8, color: 'var(--tx3)' }}>{circCollapsed ? '▸' : '▾'}</span>
          <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx2)' }}>
            {t('site_knobs_circ_section')}
          </span>
          {(circ.auto || circ.drives.light || circ.drives.shadow || circ.drives.bg || circ.drives.atm) && (
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ac)', display: 'inline-block', flexShrink: 0 }} />
          )}
        </button>
        {!circCollapsed && (
          <>
            {/* Philosophy presets */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
              {(['sun', 'gallery', 'theatre', 'custom'] as CircadianPreset[]).map(name => (
                <button
                  key={name}
                  type="button"
                  className="t-mono-xs"
                  onClick={() => applyPreset(name)}
                  style={{
                    padding: '4px 9px', fontSize: 8, letterSpacing: 1,
                    textTransform: 'uppercase', border: '1px solid var(--bd)',
                    borderRadius: 4, cursor: 'pointer',
                    background: activePreset === name ? 'var(--ac)' : 'var(--bg1)',
                    color: activePreset === name ? '#fff' : 'var(--tx2)',
                    fontFamily: 'inherit',
                  }}
                >
                  {name === 'sun'     ? t('site_knobs_circ_preset_sun')
                    : name === 'gallery'  ? t('site_knobs_circ_preset_gallery')
                    : name === 'theatre'  ? t('site_knobs_circ_preset_theatre')
                    : t('site_knobs_circ_preset_custom')}
                </button>
              ))}
            </div>

            {/* Auto toggle */}
            <label style={checkRowStyle}>
              <input
                type="checkbox"
                checked={circ.auto}
                onChange={e => patchCirc({ auto: e.target.checked })}
              />
              {t('site_knobs_circ_auto')}
            </label>

            {/* Manual scrubber — shown when auto is off */}
            {!circ.auto && (
              <div style={{ marginBottom: 10 }}>
                <Slider
                  label={t('site_knobs_circ_manual')}
                  min={0} max={1439} step={1}
                  value={circ.manual_minute}
                  onChange={v => patchCirc({ manual_minute: v })}
                  unit={` (${minutesToTimeStr(circ.manual_minute)})`}
                  defaultValue={720}
                  onReset={() => patchCirc({ manual_minute: 720 })}
                />
              </div>
            )}

            {/* Drive toggles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 6 }}>
              {([
                ['light',  t('site_knobs_circ_drive_light')],
                ['shadow', t('site_knobs_circ_drive_shadow')],
                ['bg',     t('site_knobs_circ_drive_bg')],
                ['atm',    t('site_knobs_circ_drive_atm')],
              ] as const).map(([key, label]) => (
                <label key={key} style={{ ...checkRowStyle, marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={circ.drives[key]}
                    onChange={e => patchCirc({ drives: { ...circ.drives, [key]: e.target.checked } })}
                  />
                  {label}
                </label>
              ))}
            </div>

            {/* Live preview note when auto is off */}
            {!circ.auto && (circ.drives.light || circ.drives.shadow || circ.drives.bg || circ.drives.atm) && (
              <div style={{ fontSize: 8, color: 'var(--tx3)', marginTop: 4, opacity: 0.7 }}>
                {minutesToTimeStr(circ.manual_minute)}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ── A11Y section ──────────────────────────────────────────────────────

  function A11ySection() {
    const a = knobs.site.a11y
    const isDirty = a.type_size_step !== DEFAULT_KNOB_VALUES.a11y.type_size_step ||
                    a.high_contrast !== DEFAULT_KNOB_VALUES.a11y.high_contrast
    const STEPS: { value: number; label: string }[] = [
      { value: 1,    label: t('site_knobs_a11y_step_1') },
      { value: 1.25, label: t('site_knobs_a11y_step_125') },
      { value: 1.5,  label: t('site_knobs_a11y_step_150') },
      { value: 2,    label: t('site_knobs_a11y_step_200') },
    ]
    return (
      <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 6, paddingBottom: a11yCollapsed ? 0 : 12 }}>
        <button
          type="button"
          style={{ ...familyHeaderBtn, marginBottom: a11yCollapsed ? 0 : 8 }}
          onClick={() => setA11yCollapsed(v => !v)}
        >
          <span style={{ fontSize: 8, color: 'var(--tx3)' }}>{a11yCollapsed ? '▸' : '▾'}</span>
          <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx2)' }}>
            {t('site_knobs_a11y_section')}
          </span>
          {isDirty && (
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ac)', display: 'inline-block', flexShrink: 0 }} />
          )}
        </button>
        {!a11yCollapsed && (
          <>
            {/* type_size_step — segmented */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ color: 'var(--tx2)', fontSize: 9, minWidth: 120 }}>
                {t('site_knobs_a11y_type_size')}
              </span>
              <div style={segmentedGroup}>
                {STEPS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className="t-mono-xs"
                    onClick={() => patchA11y({ type_size_step: value })}
                    style={segBtn(a.type_size_step === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* high_contrast — checkbox */}
            <label style={checkRowStyle}>
              <input
                type="checkbox"
                checked={a.high_contrast}
                onChange={e => patchA11y({ high_contrast: e.target.checked })}
              />
              {t('site_knobs_a11y_high_contrast')}
            </label>
          </>
        )}
      </div>
    )
  }

  // ── Family → renderer map ─────────────────────────────────────────────

  const FAMILY_LABEL: Record<KnobFamily, string> = {
    light:  t('site_knobs_family_light'),
    shadow: t('site_knobs_family_shadow'),
    frame:  t('site_knobs_family_frame'),
    bg:     t('site_knobs_family_bg'),
    atm:    t('site_knobs_family_atm'),
    mat:    t('site_knobs_family_mat'),
    type:   t('site_knobs_family_type'),
    motion: t('site_knobs_family_motion'),
  }

  function renderFamily(f: KnobFamily) {
    switch (f) {
      case 'light':  return <LightFamily />
      case 'shadow': return <ShadowFamily />
      case 'frame':  return <FrameFamily />
      case 'bg':     return <BgFamily />
      case 'atm':    return <AtmFamily />
      case 'mat':    return <MatFamily />
      case 'type':   return <TypeFamily />
      case 'motion': return <MotionFamily />
    }
  }

  const SCOPE_TABS: { key: Scope; label: string; disabled?: boolean }[] = [
    { key: 'site',    label: t('site_knobs_scope_site') },
    { key: 'landing', label: t('site_knobs_scope_landing') },
    { key: 'works',   label: t('site_knobs_scope_works') },
    { key: 'about',   label: t('site_knobs_scope_about') },
    { key: 'block',   label: t('site_knobs_scope_block'), disabled: !selectedBlockUid },
  ]

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Scope bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {SCOPE_TABS.map(({ key, label, disabled }) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => { if (!disabled) setScope(key) }}
            style={{
              padding: '4px 10px', fontSize: 9, letterSpacing: 1,
              textTransform: 'uppercase', borderRadius: 4, border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: disabled ? 0.38 : 1,
              background: scope === key ? 'var(--ac)' : 'var(--bg1)',
              color: scope === key ? '#fff' : 'var(--tx2)',
            }}
          >
            {label}
            {key === 'block' && selectedBlockUid && Object.keys(blockOverride).length > 0 && (
              <span style={{
                width: 4, height: 4, borderRadius: '50%',
                background: scope === key ? 'rgba(255,255,255,0.7)' : 'var(--ac)',
                display: 'inline-block', marginLeft: 5, verticalAlign: 'middle',
              }} />
            )}
            {key !== 'site' && key !== 'block' && Object.keys(knobs.pages[key as PageScope] ?? {}).length > 0 && (
              <span style={{
                width: 4, height: 4, borderRadius: '50%',
                background: scope === key ? 'rgba(255,255,255,0.7)' : 'var(--ac)',
                display: 'inline-block', marginLeft: 5, verticalAlign: 'middle',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Family accordion */}
      {ALL_FAMILIES.map(f => {
        const overrideOn = isOverrideEnabled(f)
        return (
          <div
            key={f}
            style={{
              borderTop: '1px solid var(--bd)',
              paddingTop: 6,
              paddingBottom: collapsed.has(f) ? 0 : 12,
            }}
          >
            <FamilyHead family={f} label={FAMILY_LABEL[f]} />
            {!collapsed.has(f) && (
              <div style={{ opacity: overrideOn ? 1 : 0.38, pointerEvents: overrideOn ? 'auto' : 'none' }}>
                {renderFamily(f)}
              </div>
            )}
          </div>
        )
      })}

      {/* Circadian controller — site scope only */}
      {isSiteScope && <CircadianSection />}

      {/* Accessibility — site scope only */}
      {isSiteScope && <A11ySection />}
    </div>
  )
}
