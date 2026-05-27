# /works layouts + per-mode lighting — handoff

Session: 2026-05-27. Scope: `/works` page presentation system — bevel, lighting, sizing, plus six new layout presets and the editor UX to drive them. Owner of next session: triage **Open issues** at the bottom before adding features.

---

## 1. Architecture overview

```
WorksMode (per-mode config persisted in portfolio JSON in R2)
├── layout                            // 'carousel' | 'grid' | 'procession' | 'salon' | 'vitrine'
│                                     // | 'timeline' | 'letter' | 'map' | 'constellation' | 'diptych'
├── bevel_px                          // 0–12, default 4
├── bevel_profile                     // 'smooth' | 'hard'
├── light_temp_k                      // 2700–6500K, default 4500
├── light_direction_deg               // 0–360°, default 315 (top-left)
├── light_intensity_pct               // 50–150 %, default 100
├── light_circadian                   // bool — when true, kelvin/direction/intensity follow local clock
├── cast_shadow_enabled               // bool, default true
├── cast_shadow_distance_px           // 0–40, default 15
└── cast_shadow_blur_px               // 0–60, default 22
```

The light fields, presets, helpers and the cm→px sizing math live in [`lib/works-mode-light.ts`](../lib/works-mode-light.ts).
The `WorksMode` type + migration live in [`lib/portfolio-config-types.ts`](../lib/portfolio-config-types.ts).
The editor controls live in the `works_modes` case of [`components/atelier/site/SiteEditorPanel.tsx`](../components/atelier/site/SiteEditorPanel.tsx).
The runtime mapping (R2 JSON → client props) lives in [`app/works/page.tsx`](../app/works/page.tsx).
The dispatcher + carousel + vitrine + cast-shadow render live in [`components/public/WorksClient.tsx`](../components/public/WorksClient.tsx).
Each non-carousel layout has its own component in [`components/public/works-layouts/`](../components/public/works-layouts/).

**Dev-preview helper:** `?_layout=X` URL param on `/works` overrides the persisted mode layout (no editor needed for QA).

---

## 2. Layouts

| Key | Status | Component | Notes |
|---|---|---|---|
| `carousel` | live | `WorksClient.tsx` | Original 3D card carousel. Uses bevel + cast shadow per mode. |
| `grid` | live | `WorksGrid.tsx` | Pre-existing flat thumbnail grid. Untouched this session. |
| `procession` | live | `WorksProcessionLayout.tsx` | Horizontal scroll band, equal-height works. Arrow buttons, keyboard, vertical-wheel→horizontal-scroll, parallax wall, snap-scroll `proximity` (not `mandatory`). |
| `salon` | live | `WorksSalonLayout.tsx` | Bin-packed multi-row wall. Tile aspect = image natural pixel aspect once loaded. Mobile uses smaller REF_CM. |
| `vitrine` | live | `WorksClient.tsx` (`.w-vitrine` mods) | Extends the carousel with `--thickness: 130px`, looked-down `perspective-origin: 50% 80%`, brighter top face, single plinth ground shadow (no double cast). |
| `timeline` | live | `WorksTimelineLayout.tsx` | Horizontal year-bucket axis. All works render at uniform height + aligned baseline (captions truncate to 1 line; missing captions reserve a row). Parallax + wheel hijack. |
| `letter` | live | `WorksLetterLayout.tsx` | Paginated reader, one work per page. Fixed-position pill nav at bottom (transparent). Image slot reserves `min-height: 64vh` so chrome doesn't shift between portrait/landscape pages. |
| `map` | placeholder | `WorksPlaceholderLayout.tsx` | Selectable; renders explanatory card. Needs per-work geo coords data — not in schema. |
| `constellation` | placeholder | `WorksPlaceholderLayout.tsx` | Selectable; needs theme-weight model + curation logic. |
| `diptych` | placeholder | `WorksPlaceholderLayout.tsx` | Selectable; needs new `work_pair(left_id, right_id)` relation. |

### Layout-specific rendering rules

- **Carousel + vitrine:** apply `bevel`, `cast shadow`, `light tint`. Vitrine adds `--thickness 130 px` + plinth `::before` cast shadow + tilted perspective. `.w-art-mount filter: none` on vitrine so the plinth isn't doubled.
- **Procession / salon / timeline / letter:** **no bevel, no drop-shadow, no introduced framing**. User instruction is explicit: image displayed at its raw pixel aspect, no CSS additions. Wall tint (kelvin) still applied behind tiles.

### Parallax

Both procession and timeline have a separate `.w-X-wall` div under the scroll track. It translates at `depth × scrollLeft` where:

```
depth = clamp(0.25, 0.15 + 0.05 × scrollWidth / clientWidth, 0.55)
```

Long tracks → deeper parallax. Recomputes on resize.

---

## 3. Sizing (the area-vs-aspect rule)

Carousel + salon size each work by **physical area** (cm) with **image-pixel aspect ratio**:

```
linearArea  = (largeurCm × pxPerCm) × (hauteurCm × pxPerCm)
targetArea  = linearArea ^ compressionExp           // 0.70 desktop, 0.55 mobile (carousel)
tileAspect  = naturalImage.w / naturalImage.h       // when loaded; fall back to cm aspect
h           = sqrt(targetArea / tileAspect)
w           = h × tileAspect
// + minimum-area floor on mobile (22% card area) so small works stay enjoyable
```

This makes a 100×70 cm work visibly bigger than a 30×20 cm one, but the gap is compressed so tiny works don't vanish.

**Important — do not regress this:** the user said in multiple messages, multiple ways:
> the image to be displayed in its full appearance, do not introduce anything than the actual aspect ratio from the image px

⇒ tile aspect = `natural.w / natural.h`. Cm is for **area**, never for **aspect**. If you change this, expect violence.

The “cream borders” the user saw around some works in mid-session screenshots were **inside the image files** (old cached photographs with paper margin). Not a code bug. Confirmed via DOM inspection (`mountRect.width === imageRect.width` to the pixel).

---

## 4. Per-mode lighting system

Single source of truth: [`lib/works-mode-light.ts`](../lib/works-mode-light.ts).

- `resolveWorksLight(kelvin, directionDeg, intensityPct)` → `{ tintRgba, bevelHighlightRgba, bevelShadowRgba, highlightOffset, intensity }`.
- `buildWorksBevelBoxShadow(px, profile, light)` → CSS box-shadow string with offsets rotated by `directionDeg`. Magnitudes use `√2` so 315° reproduces the original hero-bevel offsets exactly.
- `resolveCircadianValues(date)` → maps the local clock through the landing sun-arc helper (`circadianShadowGeometry` in [`lib/landing-text-shadow.ts`](../lib/landing-text-shadow.ts), which I exported) to kelvin/direction/intensity. Refreshes every 60 s when circadian is on.
- `WORKS_LIGHT_PRESETS` — write-only named combos: `warm_indoor`, `cool_indoor`, `gallery`, `daylight`, `golden_hour`, `circadian`. `matchWorksLightPreset(values)` returns the active key if all fields equal a preset, else `null` → editor shows "Custom".

### Cast shadow

`cast_shadow_enabled` gates the drop-shadow filter on `.w-card.center .w-art-mount`. Distance + blur are absolute px values multiplied by light intensity for alpha. Vitrine ignores the filter (uses its plinth `::before` only).

---

## 5. Editor (site editor → `/works page`)

The works_modes panel was refactored into a denser, three-section layout:

1. **Frame** (`bevel`) — slider + profile toggle, compact.
2. **Light** — preset chips row + active-preset badge in the section header (visible at a glance). Then sliders: temperature / direction / intensity, each `120px label · slider · 56px value` row with an inline `↺` reset chip when the value drifts from default. Circadian toggle dims the sliders when on.
3. **Cast shadow** — on/off toggle + on/off badge in the header. Distance + blur sliders dim when off.

i18n keys for the new controls are in [`lib/i18n/messages/site-blocks.messages.ts`](../lib/i18n/messages/site-blocks.messages.ts).

---

## 6. Commits shipped (origin/main)

| SHA | Title |
|---|---|
| `6d60f21` | feat(works): per-mode bevel + light temperature; mount fits image aspect |
| `50e0a47` | feat(works): per-mode light direction + intensity |
| `8a51aa4` | feat(works): per-mode circadian light (reuses landing sun arc) |
| `f5f1d0d` | feat(works): light preset chips in site editor |
| `dff7a48` | feat(works): compressed area scaling + mobile min-area floor for small works |
| `24a53ea` | feat(works): 5 new layout presets + 3 honest placeholders |
| `bf04e90` | fix(works): mobile sizing for salon, dedupe nav/css, add ?_layout preview override |
| `c0c2f09` | feat(works): bevel+light wired into all new layouts; nav arrows; outro card on all |

## 7. Uncommitted at handoff (in working tree)

Held back per the user's "stop pushing every time". These should be reviewed and committed by next session if the changes hold up to fresh eyes:

- `app/works/page.tsx` — cast shadow fields plumbed through mode mapping.
- `components/atelier/PortfolioConfigShell.tsx` — cast shadow defaults in `addMode`.
- `components/atelier/site/SiteEditorPanel.tsx` — **major refactor** of the bevel+light block + new cast shadow section. This is the bulk of the diff.
- `components/public/WorksClient.tsx` — cast shadow params applied to carousel/vitrine drop-shadow; vitrine `.w-art-mount filter: none` to kill double shadow.
- `components/public/works-layouts/WorksLetterLayout.tsx` — fixed nav pill removed (transparent now), inline-block mount, stable image slot.
- `components/public/works-layouts/WorksProcessionLayout.tsx` — wheel-hijack, parallax wall + length-scaled depth, snap `proximity`, framing stripped.
- `components/public/works-layouts/WorksSalonLayout.tsx` — natural-size tracking dropped (was a noop after framing strip), no bevel/shadow.
- `components/public/works-layouts/WorksTimelineLayout.tsx` — parallax wall, wheel hijack, uniform image height, captions truncate, framing stripped.
- `components/public/works-utils.ts` — added cast shadow fields to the shared `WorksMode` interface.
- `lib/i18n/messages/site-blocks.messages.ts` — cast shadow + layout label keys.
- `lib/portfolio-config-types.ts` — cast shadow fields in `WorksMode`, migrations, default record.
- `lib/works-mode-light.ts` — cast shadow constants + migrators.

To commit these:

```
pwsh scripts/commit-push-main.ps1 -Message 'feat(works): cast shadow per-mode + editor refactor + strip framing from flat layouts' -Paths @(
  'app/works/page.tsx',
  'components/atelier/PortfolioConfigShell.tsx',
  'components/atelier/site/SiteEditorPanel.tsx',
  'components/public/WorksClient.tsx',
  'components/public/works-layouts',
  'components/public/works-utils.ts',
  'lib/i18n/messages/site-blocks.messages.ts',
  'lib/portfolio-config-types.ts',
  'lib/works-mode-light.ts'
)
```

---

## 8. Open issues & improvements

### High priority

- **Procession reported "not working" on user's machine** — Functionally verified in preview (wheel scrolls 3666 px to end, arrow buttons move 909 px, click-to-zoom opens). Cannot repro. Need user to provide:
  - Browser + OS + input device (Mac trackpad, PC wheel, touch?)
  - Specific scenario (page won't load? wheel doesn't scroll? clicks don't zoom?)
  - Console errors if any
- **Timeline bg vertical split (user screenshot 2)** — Couldn't reproduce on either desktop (1440×900) or mobile (375×812) in the dev preview. The wrap fills viewport correctly (verified via DOM inspection). Theory: a specific scroll position or stale Next.js cache. If it recurs, capture URL + scroll position + viewport.
- **Bg gradient "barely visible"** — User flagged but I haven't acted. The current site theme stops are `white → beige → light blue` (≤ 5% RGB delta between adjacent stops). Two paths:
  - (a) Configurable contrast: add a per-mode gradient override or "boost" factor.
  - (b) Edit the default site landing gradient to higher contrast.
  Needs user direction on intent before code change.

### Medium priority

- **Carousel doesn't render `mode.outro_fr/en`** — Every other layout shows the closing card (via `OutroCard`). Carousel still uses the in-line text-card (`WorksSectionTextCard`) at the end of chapter sequences. Worth wiring `OutroCard` for consistency, or document why carousel uses a different mechanism.
- **Editor preset row wraps at narrow widths** — Cosmetic; chips can wrap to a second line below ~600 px. Acceptable as-is, could collapse to a dropdown on narrow.
- **Wheel hijack on procession/timeline blocks Mac trackpad vertical scroll** — On the `if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) preventDefault()` path, users can't scroll the page vertically when hovering the track. Track is `position: fixed inset: 0` so there's nothing to scroll past — but it feels weird. Consider a deadzone (small deltaY without intent passes through).
- **No focus-visible styling on the new arrow buttons** — Keyboard navigation works but the focused button doesn't visibly differ from idle.

### Lower priority / future

- **Map / Constellation / Diptych implementations** — All scaffolded with "coming soon" placeholders that explain what's missing. Briefs:
  - **Map**: needs a `(work_id, lat, lng, label)` table or a column on `Oeuvres`. Frontend: Leaflet/MapLibre + clustered markers, click → lightbox. ~2–3 sessions.
  - **Constellation**: needs a curation algorithm (theme weights, anchor works, orbit physics). Force-directed graph (d3-force). High UX risk — prototype before committing. ~3+ sessions.
  - **Diptych**: needs `work_pair(left_id, right_id, kind)` table + atelier UI to pair works. Renderer is simple (two-up viewer with shared zoom). ~2 sessions.
- **Modes-vs-collections clarification** — The "mode" concept is invisible scaffolding when only one mode exists. It pays off only with multiple alternative organizations (e.g. "Chronological" carousel vs "Themes" grid). Either:
  - Build a quick `/works?mode=N` switcher so the value of multi-mode is visible, OR
  - Rename "mode" → "preset" or "view" in the editor copy, OR
  - Defer: don't delete, leave dormant.
- **Per-mode sizing override** — Compression exponent + min-area floor are currently hardcoded in `WorksClient`. Could expose as a per-mode field if some modes want linear sizing and others heavy compression. No user request yet.
- **Vitrine on mobile** — Inherits carousel mobile breakpoint; the 130 px thickness may overwhelm a 375 px viewport. Scale `--thickness` with viewport.

---

## 9. Hard rules (re-emphasized for the next session)

1. **Image aspect ratio comes from image pixels only.** Cm dimensions drive **area**, never aspect. Do not introduce object-fit: cover or any cropping over the user's images. The user repeated this 4+ times this session.
2. **Procession / salon / timeline / letter render images flat.** No bevel rim, no drop-shadow. The bevel/light system is for carousel + vitrine. If you re-add framing to flat layouts, expect rejection.
3. **The cm-driven area-compression in `physicalArtDisplaySize` is load-bearing** for keeping small works visible on mobile. Don't replace with linear scaling.
4. **Do not commit unverified work.** Every commit in this session except the editor refactor was verified in `preview_start` + DOM inspection before push. Cast-shadow and editor-refactor batch is uncommitted pending review.
5. **`origin/main` is the only release truth** ([CLAUDE.md](../CLAUDE.md)). No worktree branches as release targets.

---

## 10. File inventory

New files (commits 24a53ea + c0c2f09):
- `lib/works-mode-light.ts`
- `components/public/works-layouts/WorksProcessionLayout.tsx`
- `components/public/works-layouts/WorksSalonLayout.tsx`
- `components/public/works-layouts/WorksTimelineLayout.tsx`
- `components/public/works-layouts/WorksLetterLayout.tsx`
- `components/public/works-layouts/WorksPlaceholderLayout.tsx`
- `components/public/works-layouts/OutroCard.tsx`

Modified (across session):
- `app/works/page.tsx`
- `components/atelier/PortfolioConfigShell.tsx`
- `components/atelier/site/SiteEditorPanel.tsx`
- `components/public/WorksClient.tsx`
- `components/public/works-utils.ts`
- `lib/i18n/messages/site-blocks.messages.ts`
- `lib/i18n/messages/public.messages.ts`
- `lib/landing-text-shadow.ts` (exported `circadianShadowGeometry` + `HourPeriod`)
- `lib/portfolio-config-types.ts`

---

End of handoff. Status: pushed to `origin/main` through `c0c2f09`. Working tree dirty with the editor refactor + cast shadow batch (see §7).
