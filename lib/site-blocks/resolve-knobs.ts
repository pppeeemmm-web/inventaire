/**
 * Phase 2 — knob cascade resolver.
 *
 * Implements `site → page → block` cascade. Each scope provides a
 * KnobFamilyOverrides (sparse); mergeKnobFamilies shallow-merges each
 * present family over the previous scope's full KnobValues.
 *
 * Circadian application is intentionally NOT done here — it is a runtime
 * concern (depends on `new Date()`) handled by the component that holds the
 * circadian tick state. The resolver returns a pure static merge.
 */

import type { KnobValues, KnobFamilyOverrides, KnobsConfig } from './knob-types'
import type { Page } from '@/lib/portfolio-config-types'

// ── Merge ──────────────────────────────────────────────────────────────────

function mergeFamily<T extends object>(base: T, override: Partial<T> | undefined): T {
  if (!override) return base
  return { ...base, ...override }
}

/**
 * Merge a KnobFamilyOverrides (sparse) into a KnobValues (full), returning a
 * new KnobValues. Absent families pass through unchanged; present families are
 * field-by-field merged (shallow).
 */
export function mergeKnobFamilies(base: KnobValues, override: KnobFamilyOverrides): KnobValues {
  return {
    light:  mergeFamily(base.light,  override.light),
    shadow: mergeFamily(base.shadow, override.shadow),
    frame:  mergeFamily(base.frame,  override.frame),
    bg:     mergeFamily(base.bg,     override.bg),
    mat:    mergeFamily(base.mat,    override.mat),
    type:   mergeFamily(base.type,   override.type),
    atm:    mergeFamily(base.atm,    override.atm),
    motion: mergeFamily(base.motion, override.motion),
    circ:   mergeFamily(base.circ,   override.circ),
    a11y:   mergeFamily(base.a11y,   override.a11y),
  }
}

// ── Resolver ───────────────────────────────────────────────────────────────

/**
 * Resolve effective KnobValues for `page`, optionally with a block override.
 *
 * Cascade order: site → page → block.knob_override.
 *
 * Circadian values are NOT applied here — the caller (client component with
 * circadian tick state) should use `applyCircadianToKnobs` when `circ.auto`
 * is true or `circ.manual_minute` is set. This keeps the resolver pure and
 * SSR-safe.
 *
 * @param cfg           - Top-level KnobsConfig (from migrated PortfolioConfig).
 * @param page          - Which public page context to resolve for.
 * @param blockOverride - Optional block-level overrides (Block.knob_override).
 */
export function resolveKnobs(
  cfg: KnobsConfig,
  page: Page,
  blockOverride?: KnobFamilyOverrides | null,
): KnobValues {
  let v = cfg.site
  const pageOv = cfg.pages[page]
  if (pageOv) v = mergeKnobFamilies(v, pageOv)
  if (blockOverride) v = mergeKnobFamilies(v, blockOverride)
  return v
}
