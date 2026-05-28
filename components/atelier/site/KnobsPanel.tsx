'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Slider } from '@/components/atelier/portfolio/shared/Slider'
import type { KnobsConfig, KnobValues, KnobFamily } from '@/lib/site-blocks'
import { DEFAULT_KNOB_VALUES } from '@/lib/site-blocks'
import {
  LANDING_HERO_BEVEL_PROFILE_VALUES,
  LANDING_HERO_BEVEL_PX_MAX,
} from '@/lib/landing-hero-bevel'
import {
  WORKS_LIGHT_TEMP_MIN,
  WORKS_LIGHT_TEMP_MAX,
  WORKS_LIGHT_TEMP_DEFAULT,
  WORKS_LIGHT_DIRECTION_DEFAULT,
  WORKS_LIGHT_INTENSITY_MIN,
  WORKS_LIGHT_INTENSITY_MAX,
  WORKS_LIGHT_INTENSITY_DEFAULT,
  WORKS_CAST_SHADOW_DISTANCE_MIN,
  WORKS_CAST_SHADOW_DISTANCE_MAX,
  WORKS_CAST_SHADOW_DISTANCE_DEFAULT,
  WORKS_CAST_SHADOW_BLUR_MIN,
  WORKS_CAST_SHADOW_BLUR_MAX,
  WORKS_CAST_SHADOW_BLUR_DEFAULT,
} from '@/lib/works-mode-light'
import { normalizeHexColor } from '@/lib/landing-background'

// ── Helpers ────────────────────────────────────────────────────────────────

const ALL_FAMILIES: KnobFamily[] = [
  'light', 'shadow', 'frame', 'bg', 'atm', 'mat', 'type', 'motion',
]

/** Families that are schema-reserved and not yet rendered in public pages. */
const SCHEMA_RESERVED: Set<KnobFamily> = new Set<KnobFamily>(['mat', 'type', 'motion'])

function isFamilyEdited(site: KnobValues, family: KnobFamily): boolean {
  return JSON.stringify(site[family]) !== JSON.stringify(DEFAULT_KNOB_VALUES[family])
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
}

export function KnobsPanel({ knobs, onChange }: KnobsPanelProps) {
  const { t } = useI18n()
  const site = knobs.site

  /** Initially collapse schema-reserved and atm families. */
  const [collapsed, setCollapsed] = useState<Set<KnobFamily>>(
    () => new Set<KnobFamily>([...SCHEMA_RESERVED, 'atm']),
  )

  function patchSite(patch: Partial<KnobValues>) {
    onChange({ ...knobs, site: { ...site, ...patch } })
  }

  function toggleFamily(f: KnobFamily) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })
  }

  // ── Family section header ────────────────────────────────────────────────

  function FamilyHead({
    family,
    label,
  }: {
    family: KnobFamily
    label: string
  }) {
    const edited = isFamilyEdited(site, family)
    const open = !collapsed.has(family)
    return (
      <button
        type="button"
        style={{ ...familyHeaderBtn, marginBottom: open ? 8 : 0 }}
        onClick={() => toggleFamily(family)}
      >
        <span style={{ fontSize: 8, color: 'var(--tx3)' }}>{open ? '▾' : '▸'}</span>
        <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx2)' }}>
          {label}
        </span>
        {edited && (
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--ac)',
              display: 'inline-block',
              flexShrink: 0,
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
    )
  }

  // ── LIGHT ────────────────────────────────────────────────────────────────

  function LightFamily() {
    const l = site.light
    const dl = DEFAULT_KNOB_VALUES.light
    return (
      <>
        <Slider
          label={t('site_knobs_light_temp')}
          min={WORKS_LIGHT_TEMP_MIN}
          max={WORKS_LIGHT_TEMP_MAX}
          step={100}
          value={l.temp_k}
          onChange={v => patchSite({ light: { ...l, temp_k: v } })}
          unit="K"
          defaultValue={WORKS_LIGHT_TEMP_DEFAULT}
          onReset={() => patchSite({ light: { ...l, temp_k: dl.temp_k } })}
        />
        <Slider
          label={t('site_knobs_light_dir')}
          min={0}
          max={360}
          step={5}
          value={l.direction_deg}
          onChange={v => patchSite({ light: { ...l, direction_deg: v } })}
          unit="°"
          defaultValue={WORKS_LIGHT_DIRECTION_DEFAULT}
          onReset={() => patchSite({ light: { ...l, direction_deg: dl.direction_deg } })}
        />
        <Slider
          label={t('site_knobs_light_intensity')}
          min={WORKS_LIGHT_INTENSITY_MIN}
          max={WORKS_LIGHT_INTENSITY_MAX}
          step={5}
          value={l.intensity_pct}
          onChange={v => patchSite({ light: { ...l, intensity_pct: v } })}
          unit="%"
          defaultValue={WORKS_LIGHT_INTENSITY_DEFAULT}
          onReset={() => patchSite({ light: { ...l, intensity_pct: dl.intensity_pct } })}
        />
      </>
    )
  }

  // ── SHADOW ───────────────────────────────────────────────────────────────

  function ShadowFamily() {
    const s = site.shadow
    const ds = DEFAULT_KNOB_VALUES.shadow
    return (
      <>
        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={s.enabled}
            onChange={e => patchSite({ shadow: { ...s, enabled: e.target.checked } })}
          />
          {t('site_knobs_shadow_enabled')}
        </label>
        <div style={{ opacity: s.enabled ? 1 : 0.4, pointerEvents: s.enabled ? 'auto' : 'none' }}>
          <Slider
            label={t('site_knobs_shadow_distance')}
            min={WORKS_CAST_SHADOW_DISTANCE_MIN}
            max={WORKS_CAST_SHADOW_DISTANCE_MAX}
            step={1}
            value={s.distance_px}
            onChange={v => patchSite({ shadow: { ...s, distance_px: v } })}
            unit="px"
            defaultValue={WORKS_CAST_SHADOW_DISTANCE_DEFAULT}
            onReset={() => patchSite({ shadow: { ...s, distance_px: ds.distance_px } })}
          />
          <Slider
            label={t('site_knobs_shadow_blur')}
            min={WORKS_CAST_SHADOW_BLUR_MIN}
            max={WORKS_CAST_SHADOW_BLUR_MAX}
            step={1}
            value={s.blur_px}
            onChange={v => patchSite({ shadow: { ...s, blur_px: v } })}
            unit="px"
            defaultValue={WORKS_CAST_SHADOW_BLUR_DEFAULT}
            onReset={() => patchSite({ shadow: { ...s, blur_px: ds.blur_px } })}
          />
          <Slider
            label={t('site_knobs_shadow_opacity')}
            min={0}
            max={100}
            step={1}
            value={s.opacity_pct}
            onChange={v => patchSite({ shadow: { ...s, opacity_pct: v } })}
            unit="%"
            defaultValue={ds.opacity_pct}
            onReset={() => patchSite({ shadow: { ...s, opacity_pct: ds.opacity_pct } })}
          />
        </div>
      </>
    )
  }

  // ── FRAME ────────────────────────────────────────────────────────────────

  function FrameFamily() {
    const f = site.frame
    return (
      <>
        <Slider
          label={t('site_knobs_frame_bevel')}
          min={0}
          max={LANDING_HERO_BEVEL_PX_MAX}
          step={1}
          value={f.bevel_px}
          onChange={v => patchSite({ frame: { ...f, bevel_px: v } })}
          unit="px"
          defaultValue={DEFAULT_KNOB_VALUES.frame.bevel_px}
          onReset={() => patchSite({ frame: { ...f, bevel_px: DEFAULT_KNOB_VALUES.frame.bevel_px } })}
          mb={10}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ color: 'var(--tx2)', fontSize: 9, minWidth: 120 }}>{/* profile label — inline with buttons */}</span>
          <div style={segmentedGroup}>
            {LANDING_HERO_BEVEL_PROFILE_VALUES.map(p => (
              <button
                key={p}
                type="button"
                className="t-mono-xs"
                onClick={() => patchSite({ frame: { ...f, bevel_profile: p } })}
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

  // ── BACKGROUND ───────────────────────────────────────────────────────────

  function BgFamily() {
    const bg = site.bg
    const dbg = DEFAULT_KNOB_VALUES.bg
    return (
      <>
        <Slider
          label={t('site_knobs_bg_blend_pos')}
          min={0}
          max={100}
          step={1}
          value={bg.blend_position}
          onChange={v => patchSite({ bg: { ...bg, blend_position: v } })}
          unit="%"
          defaultValue={dbg.blend_position}
          onReset={() => patchSite({ bg: { ...bg, blend_position: dbg.blend_position } })}
        />
        <Slider
          label={t('site_knobs_bg_blend_soft')}
          min={0}
          max={100}
          step={1}
          value={bg.blend_softness}
          onChange={v => patchSite({ bg: { ...bg, blend_softness: v } })}
          unit="%"
          defaultValue={dbg.blend_softness}
          onReset={() => patchSite({ bg: { ...bg, blend_softness: dbg.blend_softness } })}
        />
        <Slider
          label={t('site_knobs_bg_opacity')}
          min={0}
          max={100}
          step={1}
          value={Math.round(bg.opacity * 100)}
          onChange={v => patchSite({ bg: { ...bg, opacity: v / 100 } })}
          unit="%"
          defaultValue={Math.round(dbg.opacity * 100)}
          onReset={() => patchSite({ bg: { ...bg, opacity: dbg.opacity } })}
        />
      </>
    )
  }

  // ── ATMOSPHERE ────────────────────────────────────────────────────────────

  function AtmFamily() {
    const a = site.atm
    const da = DEFAULT_KNOB_VALUES.atm
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, fontSize: 9, marginBottom: 6, alignItems: 'center' }}>
          <span style={{ color: 'var(--tx2)' }}>{t('site_knobs_atm_sky_top')}</span>
          <input
            type="color"
            value={normalizeHexColor(a.sky_top) ?? '#0a0c12'}
            onChange={e => patchSite({ atm: { ...a, sky_top: e.target.value } })}
            aria-label={t('site_knobs_atm_sky_top')}
            style={colorInputStyle}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, fontSize: 9, marginBottom: 10, alignItems: 'center' }}>
          <span style={{ color: 'var(--tx2)' }}>{t('site_knobs_atm_sky_bottom')}</span>
          <input
            type="color"
            value={normalizeHexColor(a.sky_bottom) ?? '#1a1c24'}
            onChange={e => patchSite({ atm: { ...a, sky_bottom: e.target.value } })}
            aria-label={t('site_knobs_atm_sky_bottom')}
            style={colorInputStyle}
          />
        </div>
        <Slider
          label={t('site_knobs_atm_tint_opacity')}
          min={0}
          max={100}
          step={1}
          value={Math.round(a.tint_opacity * 100)}
          onChange={v => patchSite({ atm: { ...a, tint_opacity: v / 100 } })}
          unit="%"
          defaultValue={Math.round(da.tint_opacity * 100)}
          onReset={() => patchSite({ atm: { ...a, tint_opacity: da.tint_opacity } })}
        />
        <Slider
          label={t('site_knobs_atm_work_glow')}
          min={0}
          max={100}
          step={1}
          value={a.work_glow_pct}
          onChange={v => patchSite({ atm: { ...a, work_glow_pct: v } })}
          unit="%"
          defaultValue={da.work_glow_pct}
          onReset={() => patchSite({ atm: { ...a, work_glow_pct: da.work_glow_pct } })}
        />
      </>
    )
  }

  // ── SURFACE TEXTURE ───────────────────────────────────────────────────────

  function MatFamily() {
    const m = site.mat
    const dm = DEFAULT_KNOB_VALUES.mat
    return (
      <>
        <Slider label={t('site_knobs_mat_grain')} min={0} max={100} value={m.grain_pct}
          onChange={v => patchSite({ mat: { ...m, grain_pct: v } })}
          unit="%" defaultValue={dm.grain_pct}
          onReset={() => patchSite({ mat: { ...m, grain_pct: dm.grain_pct } })} />
        <Slider label={t('site_knobs_mat_voile')} min={0} max={100} value={m.voile_pct}
          onChange={v => patchSite({ mat: { ...m, voile_pct: v } })}
          unit="%" defaultValue={dm.voile_pct}
          onReset={() => patchSite({ mat: { ...m, voile_pct: dm.voile_pct } })} />
        <Slider label={t('site_knobs_mat_vignette')} min={0} max={100} value={m.vignette_pct}
          onChange={v => patchSite({ mat: { ...m, vignette_pct: v } })}
          unit="%" defaultValue={dm.vignette_pct}
          onReset={() => patchSite({ mat: { ...m, vignette_pct: dm.vignette_pct } })} />
      </>
    )
  }

  // ── TYPOGRAPHY ────────────────────────────────────────────────────────────

  function TypeFamily() {
    const ty = site.type
    const dty = DEFAULT_KNOB_VALUES.type
    return (
      <>
        <Slider label={t('site_knobs_type_scale')} min={75} max={200} step={25} value={ty.scale_pct}
          onChange={v => patchSite({ type: { ...ty, scale_pct: v } })}
          unit="%" defaultValue={dty.scale_pct}
          onReset={() => patchSite({ type: { ...ty, scale_pct: dty.scale_pct } })}
          mb={10} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={segmentedGroup}>
            {(['light', 'regular', 'bold'] as const).map(w => (
              <button key={w} type="button" className="t-mono-xs"
                onClick={() => patchSite({ type: { ...ty, weight: w } })}
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

  // ── MOTION ────────────────────────────────────────────────────────────────

  function MotionFamily() {
    const mo = site.motion
    const dmo = DEFAULT_KNOB_VALUES.motion
    return (
      <>
        <Slider label={t('site_knobs_motion_parallax')} min={0} max={3} step={0.25}
          value={mo.parallax_mult}
          onChange={v => patchSite({ motion: { ...mo, parallax_mult: v } })}
          defaultValue={dmo.parallax_mult}
          onReset={() => patchSite({ motion: { ...mo, parallax_mult: dmo.parallax_mult } })}
          mb={6} />
        <Slider label={t('site_knobs_motion_sway')} min={0} max={3} step={0.25}
          value={mo.sway_speed_mult}
          onChange={v => patchSite({ motion: { ...mo, sway_speed_mult: v } })}
          defaultValue={dmo.sway_speed_mult}
          onReset={() => patchSite({ motion: { ...mo, sway_speed_mult: dmo.sway_speed_mult } })}
          mb={10} />
        <label style={checkRowStyle}>
          <input type="checkbox"
            checked={mo.reduce_motion}
            onChange={e => patchSite({ motion: { ...mo, reduce_motion: e.target.checked } })} />
          {t('site_knobs_motion_reduce')}
        </label>
      </>
    )
  }

  // ── Family → renderer map ─────────────────────────────────────────────────

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

  // ── Scope bar (site only for now) ─────────────────────────────────────────

  return (
    <div>
      {/* Scope bar — currently site-only; page scopes deferred */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <span
          style={{
            padding: '4px 10px', fontSize: 9, letterSpacing: 1,
            textTransform: 'uppercase', background: 'var(--ac)', color: '#fff',
            borderRadius: 4,
          }}
        >
          {t('site_knobs_scope_site')}
        </span>
      </div>

      {/* Family accordion */}
      {ALL_FAMILIES.map(f => (
        <div
          key={f}
          style={{
            borderTop: '1px solid var(--bd)',
            paddingTop: 6,
            paddingBottom: collapsed.has(f) ? 0 : 12,
          }}
        >
          <FamilyHead family={f} label={FAMILY_LABEL[f]} />
          {!collapsed.has(f) && renderFamily(f)}
        </div>
      ))}
    </div>
  )
}
