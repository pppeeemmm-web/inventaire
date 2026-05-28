# /atelier/site — block registry + about-page composition handoff

Session: 2026-05-28. Scope: Phase 0 layout stabilization + Phase 1 of the public-site refactor (block taxonomy, registry, editor, 11 descriptors). Owner of the next session: triage **Open work** at the bottom before adding features.

Companion to the plan at `~/.claude/plans/c-users-pppee-desktop-refactor-ux-publi-jazzy-moon.md`. Read that first if you're cold.

---

## 1. Where we are

6 commits on `origin/main` from this session, in order:

| SHA | Title |
|---|---|
| `63e809d` | fix(works): stabilize procession/timeline/salon scroll, hug image rect for bevel + cast shadow on flat layouts |
| `bce306e` | feat(site-blocks): per-page block taxonomy + registry foundation |
| `c443da0` | feat(site-blocks): wrap about-page content as descriptors (biographie/approach/themes/materials) |
| `a7dce96` | feat(site-blocks): page-tabbed block-composition editor in the site panel |
| `5941d06` | feat(site-blocks): statement + divider + contact + cv descriptors |
| `2781b36` | feat(site-blocks): expositions + presse descriptors with shared row-list editor |

Working tree clean. typecheck + lint + i18n (0 blocking) + 4/4 works-layouts e2e pass.

---

## 2. Architecture as it stands

### 2.1 Block registry

`lib/site-blocks/registry.ts` exports `BlockDescriptor<Fields>`:

```ts
{
  kind: BlockKind
  allowedPages: Page[] | '*'        // schema enforcement
  knobFamilies: KnobFamily[]         // Phase 2 hook, unused today
  defaultFields: Fields
  editor: ComponentType<BlockEditorProps<Fields>>
  renderer: ComponentType<BlockRendererProps<Fields>>
  migrateFields?: (raw: unknown) => Fields
  validate?: (fields: Fields) => string[] | null
}
```

`lib/site-blocks/index.ts` is the barrel — imports + `registerBlock()` for every shipped descriptor. **Adding a kind = one folder under `lib/site-blocks/<kind>/` + one import + one `registerBlock(...)` in the barrel.** No other surgery needed.

Lookup helpers: `getDescriptor(kind)`, `kindsAllowedOnPage(page)`, `isKindAllowedOnPage(kind, page)`.

### 2.2 Page model

`lib/portfolio-config-types.ts` — new types:

```ts
type Page = 'landing' | 'works' | 'about'    // /practice folded into /about
type BlockKind = 'hero' | 'identity' | 'works_modes' | 'map' | 'motion_interior'
              | 'biographie' | 'expositions' | 'presse' | 'contact' | 'cv'
              | 'approach' | 'themes' | 'materials'
              | 'text' | 'image' | 'statement' | 'quote' | 'gallery_strip' | 'divider'
type Block = {
  uid: string                              // stable UUID
  kind: BlockKind
  page: Page
  visible: boolean
  layout_width: 'full' | 'half' | 'third'
  fields: Record<string, unknown>          // shape per kind = descriptor
  knob_override?: Record<string, unknown>  // Phase 2 slot
  sort_order: number
}
type PageBlocks = Partial<Record<Page, Block[]>>
```

`PortfolioConfig.pages?: PageBlocks` is **optional** — older configs without it get populated by `migrate()` via `deriveDefaultPages(cfg)`. The auto-generated blocks use deterministic uids `auto_${kind}_${page}` so they round-trip cleanly.

`deriveDefaultPages` reads legacy monolithic fields (`landing.hero_*`, `about.intro_*`, `practice.approach_*`, `works_modes[]`) and emits the matching block per page. **Idempotent on re-migration** so legacy edits propagate to blocks until the user edits via the new editor.

### 2.3 Editor

`components/atelier/site/PagesEditor.tsx` — new component. Mounted as a `SitePublicSection` at the **top** of `SiteEditorPanel`, above the legacy 5-kind sections (hero/identity/about/practice/works_modes).

Behaviour:
- Page tabs: Accueil / Œuvres / À propos.
- Block list per active page, sorted by `sort_order`, each card with toolbar (▴/▾ reorder, ▬/▬▬/▬▬▬ layout-width, ●/○ visibility, × remove), expandable to show the descriptor's editor.
- "Add block" dropdown filtered by `kindsAllowedOnPage(activePage)` — landing only shows universals (`text` / `statement` / `divider`), about shows all 11.
- Persists into `config.pages[page]` via `setConfig`. Saving still goes through the existing publish flow in `PortfolioConfigShell` (no separate Publier button yet — that's Phase 6 slot).

### 2.4 Public rendering

`/about` iterates `config.pages.about` via the registry. `AboutClient` (in `components/public/AboutClient.tsx`):
- Calls `migrate(result.config)` to populate `pages`.
- Renders `registryBlocks = pages.about.filter(b => b.visible && !!getDescriptor(b.kind))`.
- Gates the inline biography section behind `!biographieHandledByRegistry` — once `biographie` descriptor is registered (it is), inline section disappears and registry takes over. **Artist name `<h1>` stays in AboutClient** as structural heading, not block content.

**Not yet wired to registry:** `/`, `/works`. They still read legacy config fields directly.

---

## 3. Shipped kinds (11 of 19)

| Kind | Allowed pages | Fields | Notes |
|---|---|---|---|
| `text` | * | `title_fr/en`, `body_fr/en` | Generic rich-text universal block |
| `statement` | * | `quote_fr/en`, `attribution_fr/en` | Display-serif italic pulled quote |
| `divider` | * | `style: 'rule'\|'spacer'\|'ornament'` | Visual break |
| `biographie` | about | `intro_fr/en` (HTML) | Long bio, mirrors prior AboutClient inline styling |
| `approach` | about | `approach_fr/en` (HTML) | Ex-/practice statement |
| `themes` | about | `themes: string[]` | Chip row; one theme per line in editor |
| `materials` | about | `materials_fr/en` (HTML) | Short media description |
| `contact` | about | `email`, `gallery_name`, `gallery_address`, `note_fr/en` | Structured card |
| `cv` | about | `url`, `label_fr/en` | Single download-link button to a CV PDF |
| `expositions` | about | `rows: { year, title, venue }[]` | Sorted year-desc on render |
| `presse` | about | `rows: { source, date, excerpt_fr/en, url }[]` | Sorted date-desc, blockquote-style |

**Not shipped:** `hero`, `identity`, `works_modes`, `map`, `motion_interior`, `image`, `gallery_strip`, `quote`. Auto-generated blocks of these kinds exist in `pages` but render as nothing (no descriptor) and show up in the editor with a "Géré ailleurs" badge — honest about the gap, doesn't crash.

---

## 4. Shared primitives

### 4.1 `BlockLayoutCell`

`components/public/BlockLayoutCell.tsx`. Wraps a block with `flex: 1 0 100% | 0 1 calc(50% - 8px) | 0 1 calc(33.333% - 11px)`. Stacks full-width below 768px regardless of declared width. Not used yet on `/about` (single-column page); will matter once pages have rows.

### 4.2 `RowListEditor`

`lib/site-blocks/shared/RowListEditor.tsx`. Generic add/remove/reorder editor for any structured-row field. Takes a `columns: RowListColumn<R>[]` spec (key + i18n labelKey + flex + optional inputType + multiline) and a `defaultRow`. Used by `expositions` and `presse`. Future structured kinds should reuse it.

### 4.3 Migration helpers

`migrateBlockField`, `migratePages`, `deriveDefaultPages` in `lib/portfolio-config-types.ts`. All idempotent. `makeBlockUid()` prefers `crypto.randomUUID()`, falls back to `b_${time36}_${rand}` for SSR builds without it.

---

## 5. Hard rules learned this session (don't regress)

### 5.1 Image aspect comes from image pixels — NEVER from cm

Carried over from the previous handoff. The salon mount uses `aspect-ratio: ${naturalW} / ${naturalH}` inline so the bevel always tracks the painting silhouette, not the cm-derived tile bbox. Tile is just a positioned reservation cell, no styling on its rect. The user spotted this immediately when bevel wrapped a wider rect than the painting.

**Specifically for salon:** the tile (width/height from packSalon) and the rendered image rect may differ when cm aspect ≠ natural aspect. The mount inside the tile uses `aspect-ratio` to size to natural. Bevel + cast shadow live on the **mount via `::after`**, never on the tile.

### 5.2 Inset bevel must go on a `::after` pseudo over `<img>`

`box-shadow: inset` directly on a span containing `<img>` is invisible — the bitmap draws on top of the inset shadow. Carousel uses `::after { content: ''; position: absolute; inset: 0; pointer-events: none; box-shadow: ${bevelShadow} }` on a `position: relative` mount. **All flat layouts (procession, salon, timeline, letter) now follow the same pattern.** If you wire a new image-bearing block, do the same.

### 5.3 `scroll-snap-type: x` + `scrollLeft += dy` snaps back

This was the root cause of the original procession scroll bug. Direct `scrollLeft +=` assignment triggers snap-end, which snaps back to the nearest tile center — if you were already on a tile center, that's invisible-no-movement. **Use `el.scrollBy({ left: dy, behavior: 'auto' })`** which goes through the browser's scroll pipeline that snap respects.

Wheel hijack also needs a **strict deadzone**: only hijack when `|dy| > 30 && |dx| < 5`. Anything else (Mac trackpad diagonal, pure horizontal wheel, gentle vertical wobble) passes through. `?_diag=1` flag enables `console.log('[procession.wheel]', { dx, dy, scrollLeft, scrollWidth, clientWidth })` — keep this for future repro reports.

### 5.4 `migrateFields` is pass-through, NOT a sanitizer

**Caught this during the smoke test of slice G.** Initial implementation of `migrateRow` in `expositions/index.tsx` returned `null` for all-blank rows. That filtered out newly-added empty rows before the editor ever saw them — user clicks "+ Add exhibition", nothing happens visibly.

Rule: **`migrateFields` preserves every row, even blank ones.** The **renderer** filters blanks for display. Editor needs all rows so the user can fill them in. Same applied to `presse`.

If you add another structured-row block, follow this convention.

### 5.5 Salon `naturalSize` ref-callback, not just `onLoad`

Cached images don't fire `onLoad` (React mounts after the bitmap is already in the browser cache). Salon's `<img>` uses a callback ref:

```jsx
ref={(node) => {
  if (node && node.complete && node.naturalWidth > 0) {
    recordNatural(work.OeuvreID, node.naturalWidth, node.naturalHeight)
  }
}}
onLoad={(e) => { ... }}
```

Both paths feed the same recordNatural. **For any future block that needs to size to image natural aspect, do this.**

### 5.6 The bevel knob produces subtle output by design

The smooth bevel profile uses very low-alpha inset highlights (~0.14–0.23). On colorful paintings it can look invisible. The "hard" profile bumps alphas to ~0.55. **If the user reports "I can't see the bevel"**: first verify the pseudo is rendering (inject a debug bevel like `inset 0 0 0 3px red` on `::after`); if the pseudo paints red but the real bevel doesn't, the formula is fine — switch profile to `hard` and/or push `bevel_px` toward 12.

---

## 6. Verification methodology — DO NOT REGRESS

The previous session's procession bug was caused by **"verified in dev preview ≠ verified on user's machine"**. Specifically: the agent measured DOM state in `preview_eval`, said "works", marked done. The user opened the same URL on Windows + Edge and saw nothing scroll. Snap was eating writes.

This session fixed the methodology:

1. **`tests/works-layouts.spec.ts`** — Playwright e2e gating procession (wheel hijack + deadzone + arrow click), timeline (wheel hijack), salon (no overflow at 1440×900 + tiles in viewport + marker), carousel/grid/letter/vitrine smoke. Runs in `<10s`. Must pass before any layout-touching commit.
2. **`preview_eval` for the editor** — confirms the descriptor system works end-to-end before commit. Add-block → toolbar action → field input value persists.
3. **User confirms on actual device** — for the layouts, this is still the final gate per the plan. Editor state can be checked in preview but visual rendering on `/about` for the artist's content needs human eyes.

Playwright also has an image-load wait quirk: procession lazy-loads tiles past index 3, so don't wait for **every** `.naturalWidth > 0`. Wait for `scrollWidth > clientWidth + 50` instead.

---

## 7. Open work — pick from here

### High priority

1. **`works_modes` descriptor + wire `/works` to registry**.
   - Existing `SiteEditorPanel` block-by-kind sections (hero/identity/about/practice/works_modes) still render via legacy paths. The legacy works_modes editor carries the full bevel/light/cast-shadow knob array; wrapping it as a registry block means either (a) replicating the whole UI in the descriptor editor, or (b) having the descriptor editor delegate to the existing `WorksModeEditor` slice.
   - `pages.works` already auto-generates `works_modes` blocks (one per active mode, `fields.mode_id` references the WorksMode). Today the renderer doesn't exist → blocks skipped in registry render → falls back to `WorksClient` reading `config.works_modes` directly.
   - Goal: `app/works/page.tsx` + `WorksClient` iterate `pages.works` like `AboutClient` iterates `pages.about`. The `works_modes` descriptor's renderer mounts the existing `WorksClient` layout dispatch for one mode at a time.
   - Once done, the legacy works_modes section in `SiteEditorPanel` can retire.

2. **`hero` + `identity` descriptors + wire `/` to registry**.
   - Same story for the landing page. `pages.landing` has auto blocks `auto_hero_landing` + `auto_identity_landing`. Need descriptors that wrap the existing `LandingHeroWorkPicker` / `HeroGlossEditor` / landing gradient + caption inputs.
   - hero is rich (image picker, gradient stops, gloss, bevel) — biggest single descriptor. Reuse existing sub-components inside the descriptor's editor.
   - Once done, `app/page.tsx` + `LandingPage` iterate `pages.landing`. Legacy landing section retires.

### Medium priority

3. **`image` + `gallery_strip` descriptors.**
   - `image`: single image with caption + alt. Decision needed: (a) accept a URL paste only, (b) integrate with the existing `LandingHeroWorkPicker` for R2-backed selection. (b) is better UX but more work.
   - `gallery_strip`: row of N work thumbnails. Could share a "work picker" UI with `image`.

4. **`quote` descriptor.**
   - Like `statement` but with attribution + source-URL link. Probably 80% identical — could refactor `statement` to support optional URL field and drop a separate `quote` kind, OR keep them distinct for clarity.

5. **Phase 6 — Publier topbar.**
   - `PortfolioConfigShell` saves via existing `savePortfolioConfig` action on internal triggers. Adding a top-bar **Publier →** button with blinking-dot unsaved indicator and last-published timestamp is small but high-value UX. No new persistence path needed — wraps existing action.

### Big chunks (Phase 2 + 3)

6. **Phase 2 — knob controller + cascade.**
   - The architectural centerpiece. See plan §Phase 2. Move from per-mode-only lighting to `site → page → block` cascade with `KnobValues` shape covering light/shadow/frame/bg/mat/type/atm/motion/circ.
   - Circadian becomes a **controller**, not a knob — it writes values to a configurable subset of families per "philosophy preset" (Sun-tracking / Gallery / Theatrical / Custom). 9-keyframe table (from design handoff §5.4) replaces the current 5-period one.
   - `resolveKnobs(cfg, page, block)` is the core resolver. Returns the effective `KnobValues` after deep-merging site → page → block, then applying circadian snapshot if `circ.auto` is on.
   - UI: knobs panel section with site/page/block scope tabs. Extract `<Slider>` from the ad-hoc range inputs in `HeroGlossEditor`, `SiteEditorPanel` light controls, `PageBackgroundEditor` — one component, three usages.
   - This is multi-session work. Don't underestimate it.

7. **Phase 3 — `map` layout (forest + pins).**
   - New layout `WorksMapLayout.tsx`. New Supabase table `forest_pins(id uuid, page_key, x_pct, y_pct, work_id → works.id)` with RLS + GRANT per project rules (see `CLAUDE.md`). Forest panorama bg image uploaded to R2 `site-assets/forest-hang.avif`.
   - Block kind `map` (allowedPages: ['works']) with renderer (horizontal-scroll parallax + pin overlay) and editor (click-to-place, drag, assign-work popup, ×-to-remove). See design handoff §5.5 + §5.7 for the full pin-editor spec.
   - Mobile fallback: grid (pin precision lost at 375px).

8. **Phase 3 — `motion_interior` (looping hand-drawn video).**
   - Same pattern as map but with a video bg instead of image. New table `motion_pins(...w_pct, h_pct)` because tiles include size. **Open dependency:** the artist must provide the looping `interior-loop.webm`. Until they upload it, ships as a placeholder.

9. **Phase 4 — mobile fallback wiring.**
   - `WorksMode.mobile_fallback: WorksLayout | 'auto'` field. Auto follows a table (salon → grid, vitrine → grid, map → grid, motion_interior → grid; others unchanged). Editor surfaces per-mode override. Every block editor gets a "📱 Aperçu mobile" toggle that previews 375px rendering inline.

10. **Phase 5 — a11y.**
    - `a11y.type_size_step`, `a11y.high_contrast`, `motion.reduce_motion` are reserved slots in the planned `KnobValues` shape. Public corner widget (`A · A · A · A` + contrast toggle + reduce-motion). Persist via `localStorage`. UI ships in a later session — schema slots first.

---

## 8. File inventory

### Modified this session

- `lib/portfolio-config-types.ts` — new Page/BlockKind/Block types, `migratePages`, `deriveDefaultPages`, `makeBlockUid`. Optional `pages` field on `PortfolioConfig`.
- `lib/works-mode-light.ts` — unchanged (next session: extend to full `CircadianSnapshot` for Phase 2).
- `lib/i18n/messages/site-blocks.messages.ts` — site_composition_* + per-kind labels + RowListEditor labels.
- `lib/i18n/messages/public.messages.ts` — `pub_salon_count_works`, `pub_salon_hang_label`.
- `components/atelier/site/SiteEditorPanel.tsx` — mounts `PagesEditor` at top.
- `components/public/AboutClient.tsx` — iterates `pages.about` via registry; gates inline biography on `getDescriptor('biographie')`.
- `components/public/works-layouts/WorksProcessionLayout.tsx` — wheel-hijack deadzone, `scrollBy` not `scrollLeft +=`, ::after bevel pseudo, caption-reserve.
- `components/public/works-layouts/WorksTimelineLayout.tsx` — same pattern.
- `components/public/works-layouts/WorksSalonLayout.tsx` — viewport-fit packer, aspect-ratio mount, callback-ref onLoad.
- `components/public/works-layouts/WorksLetterLayout.tsx` — bevel + cast shadow via ::after.

### Created this session

- `lib/site-blocks/registry.ts`
- `lib/site-blocks/index.ts`
- `lib/site-blocks/text/{TextRenderer.tsx, TextEditor.tsx, index.tsx}`
- `lib/site-blocks/biographie/{BiographieRenderer.tsx, BiographieEditor.tsx, index.tsx}`
- `lib/site-blocks/approach/{ApproachRenderer.tsx, ApproachEditor.tsx, index.tsx}`
- `lib/site-blocks/themes/{ThemesRenderer.tsx, ThemesEditor.tsx, index.tsx}`
- `lib/site-blocks/materials/{MaterialsRenderer.tsx, MaterialsEditor.tsx, index.tsx}`
- `lib/site-blocks/statement/{StatementRenderer.tsx, StatementEditor.tsx, index.tsx}`
- `lib/site-blocks/divider/{DividerRenderer.tsx, DividerEditor.tsx, index.tsx}`
- `lib/site-blocks/contact/{ContactRenderer.tsx, ContactEditor.tsx, index.tsx}`
- `lib/site-blocks/cv/{CvRenderer.tsx, CvEditor.tsx, index.tsx}`
- `lib/site-blocks/expositions/{ExpositionsRenderer.tsx, ExpositionsEditor.tsx, index.tsx}`
- `lib/site-blocks/presse/{PresseRenderer.tsx, PresseEditor.tsx, index.tsx}`
- `lib/site-blocks/shared/RowListEditor.tsx`
- `components/atelier/site/PagesEditor.tsx`
- `components/public/BlockLayoutCell.tsx`
- `tests/works-layouts.spec.ts`

---

## 9. Pattern for adding a new block kind

Copy `lib/site-blocks/cv/` as the template (smallest descriptor with editor + renderer + migrateFields). Five steps:

1. **Create folder** `lib/site-blocks/<kind>/`:
   - `<Kind>Renderer.tsx` — exports default component + `Fields` type + `DEFAULTS` const. Returns null when fields are effectively empty.
   - `<Kind>Editor.tsx` — exports default component. Reads `fields`, calls `onChange(patch)` on every keystroke.
   - `index.tsx` — exports `<kind>Descriptor: BlockDescriptor<Fields>` with kind / allowedPages / defaultFields / editor / renderer / migrateFields.
2. **Register** in `lib/site-blocks/index.ts`: import + `registerBlock(...)` in alphabetical order.
3. **i18n** in `lib/i18n/messages/site-blocks.messages.ts`: at minimum `site_block_kind_<kind>` and any editor-specific labels.
4. **Optional**: add to `KIND_LABEL_KEY` in `components/atelier/site/PagesEditor.tsx` so the editor shows a localized label instead of the raw kind string.
5. **Smoke test in `/atelier/site`**: about tab → add block → expand → fill fields → values persist in React state. If the field is a list, **verify add-row immediately produces a visible row** (this caught the `migrateRow` bug).

For structured-row blocks (like expositions/presse): use `RowListEditor` from `lib/site-blocks/shared/`. Just supply a `columns` spec + `defaultRow`. Don't filter blank rows in `migrateFields` — the renderer is the place for that.

---

## 10. Commands the next session will need

```bash
# Dev server (Windows pwsh)
pwsh scripts/dev.ps1
# OR via Claude Preview tool: launch.json already has "PEM Hub (Next.js)"

# Type + lint + i18n
npm run typecheck
npm run lint
npm run i18n:check

# Layout e2e (gates the Phase 0 fixes)
npx playwright test tests/works-layouts.spec.ts --reporter=list

# Commit + push to main (don't skip hooks)
pwsh -Command "& ./scripts/commit-push-main.ps1 -Message '...' -Paths @('lib/site-blocks/<kind>', ...)"

# Release truth before any 'pushed' claim
pwsh -Command "& ./scripts/release-truth.ps1 -Checks 'typecheck,i18n,e2e' -RequirePushed"
```

`origin/main` is the only release truth (per `CLAUDE.md`). No worktree branches as targets.

---

End of handoff. Status: pushed to `origin/main` through `2781b36`. Working tree clean. 11 of 19 block kinds shipped, `/about` is fully registry-driven, `/` and `/works` are still on the legacy path. Pick from §7 to continue.
