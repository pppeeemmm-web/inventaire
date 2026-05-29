# /atelier/site — block registry handoff (session 3)

Session: 2026-05-28. Scope: completing Phase 2 knob controller. Owner: read §4 Open work before adding features.

**Corrected 2026-05-29** — §4 re-verified file-by-file against live code. Page scope and the circadian controller were marked "open" but are in fact shipped; §4 now reflects what is actually unbuilt.

Prior sessions: HANDOFF_SITE_BLOCKS.md + HANDOFF_SITE_BLOCKS_2.md (both archived under `docs/archive/`). Read if cold.

---

## 1. Where we are

6 commits on `origin/main` from the last two sessions:

| SHA | Title |
|---|---|
| `bb1156e` | feat(works): mobile fallback layout per WorksMode |
| `1bce820` | feat(site-blocks): Phase 2 knob cascade — type layer + resolver |
| `88f0c1c` | refactor(editor): extract shared Slider component, replace 9 ad-hoc range inputs |
| `8662a60` | feat(site-blocks): Phase 2 UI — KnobsPanel with 8 knob families + i18n |

Working tree clean. typecheck + lint (0 errors) + i18n (0 blocking) pass.

---

## 2. What shipped this session

### 2.1 Phase 4 — `WorksMode.mobile_fallback`

`lib/works-mode-light.ts`:
- Added `migrateWorksMobileFallback(v)`: coerces unknown → `WorksLayout | 'auto'`
- Added `AUTO_MOBILE_FALLBACK` map: salon/vitrine/map/constellation/diptych → `'grid'`
- Added `resolveWorksMobileLayout(desktopLayout, mobileFallback)`: applies the fallback

`app/works/page.tsx` — `mobile_fallback` now populated on all three WorksMode construction paths.

`components/public/WorksClient.tsx` — `effectiveLayout` computed after `isMobile` state; applies `resolveWorksMobileLayout` on mobile.

`components/atelier/PortfolioConfigShell.tsx` — `addMode` factory includes `mobile_fallback: 'auto'`.

`SiteEditorPanel.tsx` — compact `<select>` for mobile fallback below the layout buttons.

### 2.2 Phase 2 data layer — knob cascade types

`lib/site-blocks/knob-types.ts` (new file):
- `KnobFamily` union (8 members: light, shadow, frame, bg, mat, type, atm, motion)
- `KnobValues` — full per-scope shape with 10 families (+ circ + a11y)
- `KnobFamilyOverrides` — sparse per-family `Partial<…>` for page/block overrides
- `KnobsConfig` — `{ site: KnobValues, pages: Partial<Record<Page, KnobFamilyOverrides>> }`
- `DEFAULT_KNOB_VALUES`, `DEFAULT_KNOBS_CONFIG`, migration helpers

`lib/site-blocks/resolve-knobs.ts` (new file):
- `mergeKnobFamilies(base, override)` — shallow merge per family
- `resolveKnobs(cfg, page, blockOverride?)` — cascade `site → page → block`

`lib/portfolio-config-types.ts`:
- `PortfolioConfig.knobs?: KnobsConfig` added
- `Block.knob_override` narrowed from `Record<string, unknown>` to `KnobFamilyOverrides`
- `migrate()` calls `migrateKnobsConfig(raw.knobs ?? null)`

`lib/site-blocks/index.ts` — exports `KnobValues`, `KnobFamilyOverrides`, `KnobsConfig`, `DEFAULT_KNOB_VALUES`, `DEFAULT_KNOBS_CONFIG`, `migrateKnobValues`, `migrateKnobFamilyOverrides`, `migrateKnobsConfig`, `resolveKnobs`, `mergeKnobFamilies`.

### 2.3 Shared `Slider` component

`components/atelier/portfolio/shared/Slider.tsx` (new file):
```tsx
<Slider
  label="Translated string"
  min={0} max={100} step={1}
  value={v} onChange={v => …}
  unit="px"                       // optional; "°" = no space, others space-prefixed
  defaultValue={50}               // when set + value !== default, shows ↺ chip
  onReset={() => …}               // optional; defaults to onChange(defaultValue)
  layout="row"                    // 'row' (default) | 'stack'
  labelWidth={120}                // row layout label column px (default 120)
  mb={6}                          // bottom margin px (default 6)
/>
```
- `layout="row"` — three-column grid `[label | range | value+unit+reset]`
- `layout="stack"` — label above range, no value display

All 9 pre-existing ad-hoc `<input type="range">` in HeroGlossEditor, SiteEditorPanel, PageBackgroundEditor replaced.

### 2.4 Phase 2 UI — KnobsPanel

`components/atelier/site/KnobsPanel.tsx` (new file):
- Props: `{ knobs: KnobsConfig, onChange: (next: KnobsConfig) => void }`
- Scope bar: Site tab (page/block scopes deferred — see §4)
- 8 collapsible family accordion sections: light, shadow, frame, bg, atm, mat, type, motion
- Orange dot on family header when any field ≠ `DEFAULT_KNOB_VALUES[family]`
- `mat`, `type`, `motion` show *"Schéma réservé — non rendu"* badge (start collapsed)
- Wired into `SiteEditorPanel` as new `SitePublicSection` "Ambiance" (after Composition, before block sections)
- `DEFAULT_KNOBS_CONFIG` used as fallback when `config.knobs` is undefined

`lib/i18n/messages/knobs-panel.messages.ts` (new file) — 38 keys registered in `index.ts`.

---

## 3. Architecture summary (Phase 2 data model)

```
PortfolioConfig.knobs: KnobsConfig
  ├── site: KnobValues          ← full shape, all families
  └── pages: {
        landing?: KnobFamilyOverrides
        works?:   KnobFamilyOverrides
        about?:   KnobFamilyOverrides
      }

Block.knob_override?: KnobFamilyOverrides   ← per-block override (stored in block.fields or block root)

resolveKnobs(cfg, page, blockOverride?) → KnobValues
  cascade: cfg.site → cfg.pages[page] → blockOverride
```

`KnobValues.circ` and `KnobValues.a11y` exist in the type but are NOT in `KnobFamily` and not part of the 8 family accordions. `circ` is now driven by `lib/circadian-knobs.ts` and edited via the dedicated `CircadianSection` (site scope). `a11y` remains an unbuilt schema slot for Phase 5.

---

## 4. Open work

> **Re-verified against live code 2026-05-29** (session 3) and **session 4 completions**. Items §4.1–§4.3 are shipped; remaining open items below.

### Shipped — session 3 (stale claim corrections)

- **KnobsPanel page scope** — live. `KnobsPanel.tsx`: `Scope = 'site' | 'landing' | 'works' | 'about'`, per-page `KnobFamilyOverrides`, per-family override toggle, per-page orange dot.
- **Circadian controller (data + UI)** — live. `lib/circadian-knobs.ts`: 9-period keyframe table, `interpolateCircadianSnapshot`, `applyCircadianToKnobs`, `CIRCADIAN_PRESETS`. `KnobsPanel.CircadianSection` renders preset chips + auto toggle + manual-minute scrubber (site scope only).
- **`gallery_strip` renderer** — real renderer, not a stub.

### Shipped — session 4 (2026-05-29) ← all keystone items closed

- **§4.1 landing** — `HeroRenderer` + `IdentityRenderer` are now real components using `LandingHeroCtx`. `LandingPage` wraps with `LandingHeroCtx.Provider`, renders renderers when blocks present, legacy fallback otherwise. `app/page.tsx` passes `landingBlocks` + `knobs`.
- **§4.1 works** — `WorksClient` is now a thin shell (context + nav + base CSS). All gallery logic extracted to `components/public/WorksModeGallery.tsx`. `WorksRenderCtx` (`lib/site-blocks/works_modes/WorksRenderCtx.ts`) provides works data. `WorksModesRenderer` is real — reads context, renders `WorksModeGallery`.
- **§4.2 Circadian public wiring** — `LandingPage` resolves `effectiveKnobs` via `resolveKnobs(knobs, 'landing')` + `applyCircadianToKnobs` on each shadow tick. ATM tint overlay renders inside `.stage` when `tint_opacity > 0`.
- **§4.3 KnobsPanel block scope** — 5th scope tab "Block" (disabled when no block selected). `PagesEditor` fires `onBlockSelect(uid)` on expand. `SiteEditorPanel` lifts `selectedBlockUid` state, wires `selectedBlockOverride` + `onBlockOverrideChange` to KnobsPanel.

### 4.4 Phase 3 — `map` + `motion_interior` layouts (blocked on assets)

- `map` needs: forest panorama bg R2 asset + `forest_pins` Supabase table
- `motion_interior` needs: `interior-loop.webm` from artist
- Both are placeholder layouts (`WORKS_LAYOUT_PLACEHOLDERS`) showing ◌ in the editor. No `lib/site-blocks/map` or `/motion_interior` dir yet.

### 4.5 Phase 5 — a11y (deferred)

`KnobValues.a11y` schema slots exist: `{ type_size_step, high_contrast }`. No UI yet.

---

## 5. Key file locations

| File | Purpose |
|---|---|
| `lib/site-blocks/knob-types.ts` | KnobValues, KnobFamilyOverrides, KnobsConfig, defaults, migration |
| `lib/site-blocks/resolve-knobs.ts` | resolveKnobs(), mergeKnobFamilies() (pure; no circadian) |
| `lib/circadian-knobs.ts` | 9-period keyframe table, applyCircadianToKnobs, CIRCADIAN_PRESETS |
| `lib/site-blocks/index.ts` | barrel — imports + re-exports everything |
| `components/atelier/portfolio/shared/Slider.tsx` | shared row/stack slider |
| `components/atelier/site/KnobsPanel.tsx` | knob panel — site + page + block scopes + CircadianSection |
| `lib/site-blocks/hero/LandingHeroCtx.ts` | React context for LandingPage → HeroRenderer/IdentityRenderer |
| `components/public/WorksModeGallery.tsx` | Extracted gallery (carousel + all layouts) — moved from WorksClient |
| `lib/site-blocks/works_modes/WorksRenderCtx.ts` | React context for WorksClient → WorksModesRenderer |
| `components/atelier/site/SiteEditorPanel.tsx` | top-level editor shell |
| `lib/i18n/messages/knobs-panel.messages.ts` | 38 keys for KnobsPanel |
| `lib/works-mode-light.ts` | light presets, migrateWorksMobileFallback, resolveWorksMobileLayout |
| `lib/portfolio-config-types.ts` | PortfolioConfig type (knobs wired here) |

---

## 6. Commands for next session

```bash
# Dev server
pwsh scripts/dev.ps1

# Type + lint + i18n
npm run typecheck && npm run lint && npm run i18n:check

# Commit + push
pwsh -Command "& ./scripts/commit-push-main.ps1 -Message '...' -Paths @('...')"

# Release truth
pwsh -Command "& ./scripts/release-truth.ps1 -Checks 'typecheck,i18n'"
```

---

End of handoff. Status (2026-05-29, session 4): All §4.1–§4.3 items shipped. Open: `map`/`motion_interior` assets (§4.4), a11y knobs (§4.5). See §4.
