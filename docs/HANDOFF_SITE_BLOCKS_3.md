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

> **Re-verified against live code 2026-05-29**, file-by-file. Two items previously listed here as open are in fact shipped — see "Shipped since this handoff" below. The remaining open items are ordered by what unblocks what.

### Shipped since this handoff (corrects earlier stale claims)

- **KnobsPanel page scope** — live. `KnobsPanel.tsx`: `Scope = 'site' | 'landing' | 'works' | 'about'`, scope bar (`SCOPE_TABS`), per-page `KnobFamilyOverrides`, per-family override toggle, per-page orange dot.
- **Circadian controller (data + UI)** — live. `lib/circadian-knobs.ts` holds the 9-period keyframe table, `interpolateCircadianSnapshot`, `applyCircadianToKnobs` (patches only the families in `circ.drives`), and `CIRCADIAN_PRESETS` (sun / gallery / theatre / custom). `KnobsPanel.CircadianSection` renders preset chips + auto toggle + manual-minute scrubber + 4 drive toggles (site scope only).
- **`gallery_strip` renderer** — real renderer (returns null only when empty), not a stub.

### 4.1 `/` + `/works` still on the legacy render path  ← keystone

`HeroRenderer`, `IdentityRenderer`, `WorksModesRenderer` are unconditional `(): null { return null }` stubs (verified 2026-05-29). Only `/about` is registry-driven. `/` renders via the legacy `LandingPage`; `/works` via the legacy `WorksClient` (reads `config.works_modes` directly). Refactoring `LandingPage` + `WorksClient` to iterate `pages.landing` / `pages.works` through the block registry is the big structural item — most of the rest either folds into it (4.2) or is independent.

### 4.2 Circadian — public wiring (last mile, gated on 4.1)

Controller + panel are done (see above). What remains: call `applyCircadianToKnobs(resolvedKnobs, minuteOfDay)` in the public landing client — `new Date().getHours() * 60 + getMinutes()` when `circ.auto`, else `circ.manual_minute` for preview. Cannot land until `/` iterates the registry (4.1): there is no public block render to apply the knobs to yet.

### 4.3 KnobsPanel — block scope (deferred)

Site + page scopes are live; block scope is not. Needs `selectedBlockUid` + `onBlockOverrideChange` plumbed from PagesEditor into KnobsPanel, editing `selectedBlock.knob_override: KnobFamilyOverrides`, surfaced as a 5th scope entry enabled only when a block is selected.

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
| `components/atelier/site/KnobsPanel.tsx` | knob panel — site + page scopes + CircadianSection (block scope pending) |
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

End of handoff. Status (2026-05-29): Phase 2 data layer + UI complete — site **and** page scopes live, circadian controller (data + panel) live. Open: `/` + `/works` legacy render path (keystone), circadian public wiring (gated on it), KnobsPanel block scope, `map`/`motion_interior` assets, a11y. See §4.
