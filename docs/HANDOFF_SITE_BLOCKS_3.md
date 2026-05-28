# /atelier/site — block registry handoff (session 3)

Session: 2026-05-28. Scope: completing Phase 2 knob controller. Owner: read §4 Open work before adding features.

Companion to HANDOFF_SITE_BLOCKS_2.md (prior session). Read both if cold.

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

`KnobValues.circ` and `KnobValues.a11y` exist in the type but are NOT in `KnobFamily` and not surfaced in the KnobsPanel families. They are schema slots for Phase 5.

---

## 4. Open work

### 4.1 KnobsPanel — page & block scope tabs (deferred from Phase 2 UI)

Currently only the "Site" tab is implemented. The full spec calls for:

**Page scope (`Landing | Works | About` tabs):**
- Each shows `config.knobs.pages[page]` as sparse `KnobFamilyOverrides`
- Each family has an "Override" toggle. Off = grayed sliders showing inherited site value; On = saves to `pages[page].family`
- Orange dot when a page has any override for that family

**Block scope:**
- Only available when a block is selected in PagesEditor
- Edits `selectedBlock.knob_override: KnobFamilyOverrides`
- Requires passing `selectedBlockUid` + `onBlockOverrideChange` into KnobsPanel or SiteEditorPanel

Implementation approach:
1. Extend `KnobsPanel` props with `activePage: 'landing' | 'works' | 'about'` (set by SiteEditorPanel based on scroll/selection)
2. Add scope tabs to the bar: `[Site] [Accueil] [Œuvres] [À propos]`
3. Site scope: unchanged
4. Page scope: render each family with `overrideEnabled` flag; toggle adds/removes the family entry from `pages[scope]`
5. Block scope: deferred further — needs editor context plumbing

### 4.2 Circadian controller (deferred from Phase 2)

The `KnobValues.circ` family (not in `KnobFamily`, not in the current panel) drives time-based variation:

```ts
circ: {
  auto: boolean          // when true, use visitor's clock
  manual_minute: number  // 0–1439 for scrubber preview
  drives: {
    light: boolean
    shadow: boolean
    bg: boolean
    atm: boolean
  }
}
```

**What needs building:**

1. **`lib/landing-text-shadow.ts`** — replace the 5-period keyframe table with a 9-period one covering the full diurnal cycle (pre-dawn, dawn, morning, midday, afternoon, golden-hour, dusk, evening, night). The existing `CircadianSnapshot` type only covers text-shadow. Extend or replace with a full type:
   ```ts
   export type CircadianSnapshot = {
     light: Partial<KnobValues['light']>
     shadow: Partial<KnobValues['shadow']>
     bg: Partial<KnobValues['bg']>
     atm: Partial<KnobValues['atm']>
   }
   ```

2. **`applyCircadianToKnobs(knobs: KnobValues, minuteOfDay: number): KnobValues`** — reads `knobs.circ.drives`, interpolates the 9-period table, patches only the driven families. Lives in `lib/landing-text-shadow.ts` or a new `lib/circadian-knobs.ts`.

3. **Circadian section in `KnobsPanel`** — below the 8 families, a collapsible "CIRCADIEN" section:
   - `[checkbox] Automatique (horloge du visiteur)`
   - Scrubber: 0–1439 manual_minute slider
   - Drive toggles: `[x] Lumière  [x] Ombres  [x] Fond  [x] Atmosphère`
   - 4 philosophy presets: Sun-tracking / Gallery / Theatrical / Custom (chips like light presets)

4. **`applyCircadianToKnobs` wired into the public page client**: when `circ.auto = true`, call with `new Date().getHours() * 60 + new Date().getMinutes()`.

### 4.3 Phase 3 — `map` + `motion_interior` layouts (blocked on assets)

- `map` needs: forest panorama bg R2 asset + `forest_pins` Supabase table
- `motion_interior` needs: `interior-loop.webm` from artist
- Both are placeholder layouts (`WORKS_LAYOUT_PLACEHOLDERS` set) and show ◌ badge in the editor

### 4.4 Phase 5 — a11y (deferred)

`KnobValues.a11y` schema slots exist: `{ type_size_step: number, high_contrast: boolean }`. No UI yet.

---

## 5. Key file locations

| File | Purpose |
|---|---|
| `lib/site-blocks/knob-types.ts` | KnobValues, KnobFamilyOverrides, KnobsConfig, defaults, migration |
| `lib/site-blocks/resolve-knobs.ts` | resolveKnobs(), mergeKnobFamilies() |
| `lib/site-blocks/index.ts` | barrel — imports + re-exports everything |
| `components/atelier/portfolio/shared/Slider.tsx` | shared row/stack slider |
| `components/atelier/site/KnobsPanel.tsx` | Phase 2 panel (site scope only) |
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

End of handoff. Status: pushed to `origin/main` through `8662a60`. Working tree clean.
Phase 2 data layer complete. Phase 2 UI: site-scope KnobsPanel live. Page/block scopes + circadian controller remain.
