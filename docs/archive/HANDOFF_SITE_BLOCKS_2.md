# /atelier/site — block registry handoff (session 2)

Session: 2026-05-28. Scope: completing §7 quick-wins from HANDOFF_SITE_BLOCKS.md. Owner: triage **Open work** at the bottom before adding features.

Companion to HANDOFF_SITE_BLOCKS.md (prior session). Read that first if cold.

---

## 1. Where we are

4 commits on `origin/main` from this session:

| SHA | Title |
|---|---|
| `2f4d53c` | feat(site-blocks): works_modes descriptor — editor surface + systemManaged flag |
| `76daa9e` | feat(site-blocks): hero + identity descriptors — editor surface |
| `ec1dcdf` | feat(site-blocks): image + quote descriptors with public renderers |
| `1add6e8` | feat(portfolio): Publier topbar — dirty indicator + last-published timestamp |

Working tree clean. typecheck + lint (0 errors) + i18n (0 blocking) pass.

---

## 2. What shipped

### 2.1 `systemManaged` flag on `BlockDescriptor`

`lib/site-blocks/registry.ts` — new optional field:
```ts
systemManaged?: boolean
```
When `true`: auto-generated block, excluded from PagesEditor "Add block" dropdown.
`PagesEditor` now filters `kindsAllowedOnPage(activePage).filter(k => !getDescriptor(k)?.systemManaged)` for addable kinds.

### 2.2 works_modes descriptor (editor-only)

`lib/site-blocks/works_modes/` — `systemManaged: true`, `allowedPages: ['works']`.
- Editor: info card showing mode label + layout + ID with Diffusion redirect hint.
- Renderer: returns null (public /works still uses legacy WorksClient path).
- `deriveDefaultPages` extended to include `label_fr`, `label_en`, `layout` in fields so editor can display without config access.

PagesEditor Œuvres tab now shows each active mode as a named block card instead of "Géré ailleurs".

### 2.3 hero + identity descriptors (editor-only)

`lib/site-blocks/hero/` — `systemManaged: true`, `allowedPages: ['landing']`.
- Editor: shows hero circle thumbnail + captions when `hero_image_key` is populated.
- Renderer: returns null (legacy LandingPage path intact).

`lib/site-blocks/identity/` — `systemManaged: true`, `allowedPages: ['landing']`.
- Editor: shows artist name.
- Renderer: returns null.

`deriveDefaultPages` Pick extended to include `landing` — hero auto-block now carries `hero_image_key`, `hero_caption_fr/en`; identity auto-block carries `artist_name`.

### 2.4 image + quote descriptors (with real renderers)

`lib/site-blocks/image/` — `allowedPages: '*'`, URL-paste variant.
- Editor: URL input + inline thumbnail preview + alt FR/EN + caption FR/EN.
- Renderer: `<figure><img><figcaption>` — returns null if URL empty.

`lib/site-blocks/quote/` — `allowedPages: '*'`.
- Like `statement` (display-serif blockquote) but adds optional `source_url` that hyperlinks the attribution.
- Editor: quote FR/EN + attribution FR/EN + source URL.
- Renderer: `<figure><blockquote><figcaption>` with `<a>` if URL present.

### 2.5 Publier topbar (Phase 6)

`PortfolioConfigShell.tsx`:
- `savedConfigRef` (useRef): stores `JSON.stringify(config)` at last successful load or save.
- `isDirty` (useMemo): `savedConfigRef.current !== '' && JSON.stringify(config) !== savedConfigRef.current`.
- Blinking dot (`publier-dot-blink` CSS keyframe, 1.2s): shown when `isDirty && !saveBusy`.
- Last-published timestamp (HH:MM, locale-aware): shown below the button after first save; "Jamais publié / Never published" before.
- Save success: removed `alert()` — timestamp update is the feedback.
- New message module: `lib/i18n/messages/portfolio-config.messages.ts` (5 keys).

---

## 3. Block inventory (17 of 19)

| Kind | Allowed pages | systemManaged | Has renderer |
|---|---|---|---|
| `text` | * | no | ✅ |
| `statement` | * | no | ✅ |
| `divider` | * | no | ✅ |
| `image` | * | no | ✅ |
| `quote` | * | no | ✅ |
| `biographie` | about | no | ✅ |
| `approach` | about | no | ✅ |
| `themes` | about | no | ✅ |
| `materials` | about | no | ✅ |
| `contact` | about | no | ✅ |
| `cv` | about | no | ✅ |
| `expositions` | about | no | ✅ |
| `presse` | about | no | ✅ |
| `hero` | landing | yes | null |
| `identity` | landing | yes | null |
| `works_modes` | works | yes | null |
| `gallery_strip` | * | no | ❌ (not shipped) |
| `map` | works | no | ❌ (not shipped) |
| `motion_interior` | works | no | ❌ (not shipped) |

**`/about` is fully registry-driven.** `/` and `/works` still on legacy path (renderers are null stubs; LandingPage / WorksClient handle their own rendering).

---

## 4. Open work (updated §7)

### High priority (not yet done)

1. **`gallery_strip` descriptor.**
   - Decision pending from §7: option (b) — integrate with R2-backed work picker — is better UX.
   - Needs the work picker to be made available to the block editor ctx (currently only in SiteEditorPanel props).
   - V1 shortcut: accept a list of R2 image keys (one per line in a textarea), same URL-paste pattern as `image`. Renderer: horizontal flex of `<img>` tags. Can be upgraded to work-picker later.
   - `RowListEditor` won't help here (images need a different input). Custom list editor with add/remove rows, URL input per row.

2. **Wire `/works` public rendering to registry.**
   - `works_modes` renderer is a null stub. Full migration requires:
     - Restructure `WorksClient` to iterate `pages.works` blocks instead of `modes[]`.
     - Pass `works[]` and `modeMap` through to each `works_modes` block renderer.
     - One renderer instance per mode — the tab bar still orchestrated by `WorksPageClient`.
   - Legacy path continues to work; no regression risk during migration.

3. **Wire `/` public rendering to registry.**
   - Same pattern. `hero` and `identity` renderers are null stubs.
   - `LandingPage` needs to iterate `pages.landing` blocks.
   - Hero renderer would mount `LandingHeroWorkPicker`, gloss, bevel, gradient editors from fields (rather than from `config.landing`).
   - Data migration: at first save via PagesEditor, hero/identity fields in block override the auto-generated ones; `savePortfolioConfig` persists both `config.landing` and `pages.landing` (they're already in the same JSON blob).

### Medium priority

4. **Phase 2 — knob controller + cascade.** (Multi-session — see HANDOFF_SITE_BLOCKS.md §7 item 6.)

5. **Phase 3 — `map` + `motion_interior` layouts.** (Multi-session — see §7 items 7–8. Depends on artist-provided assets.)

6. **Phase 4 — mobile fallback wiring.** (`WorksMode.mobile_fallback` field + editor toggle + 375px preview.)

7. **Phase 5 — a11y schema slots.** (Reserve fields in KnobValues, public corner widget — later session.)

---

## 5. Patterns consolidated this session

### systemManaged kinds
Use `systemManaged: true` on `BlockDescriptor` for any kind whose blocks are auto-generated from other config sources (config.landing, config.general, config.works_modes). These don't appear in the "Add block" dropdown. Examples: `hero`, `identity`, `works_modes`. Future: `map`, `motion_interior`.

### null renderers for legacy-path pages
Until a public page is refactored to iterate blocks, the renderer for that page's kinds returns `null`. The public page handles rendering itself via the existing component. No regression. Future migration = replace null return with actual layout component.

### URL-paste `image` block → future R2 upgrade path
The `image` descriptor accepts any `https://` URL. To upgrade to R2-backed selection later:
1. Add `hero_image_key` field alongside `url`.
2. Show `LandingHeroWorkPicker` in the editor (requires passing `oeuvres` into `BlockEditorCtx`).
3. Renderer uses `thumbUrl(hero_image_key)` if key present, falls back to `url`.

### Extending `BlockEditorCtx` for data-dependent editors
Current: `{ page: Page, lang: 'fr' | 'en' }`.
When hero/identity/gallery_strip editors need oeuvres access, extend:
```ts
export interface BlockEditorCtx {
  page: Page
  lang: 'fr' | 'en'
  /** Optional: oeuvres list for image/gallery pickers. */
  oeuvres?: LandingHeroWorkLite[]
}
```
`PagesEditor` would receive `oeuvres` as a prop from `SiteEditorPanel` and pass in ctx.

---

## 6. Commands for next session

```bash
# Dev server
pwsh scripts/dev.ps1

# Type + lint + i18n
npm run typecheck && npm run lint && npm run i18n:check

# Layout e2e
npx playwright test tests/works-layouts.spec.ts --reporter=list

# Commit + push
pwsh -Command "& ./scripts/commit-push-main.ps1 -Message '...' -Paths @('...')"

# Release truth
pwsh -Command "& ./scripts/release-truth.ps1 -Checks 'typecheck,i18n,e2e' -RequirePushed"
```

---

End of handoff. Status: pushed to `origin/main` through `1add6e8`. Working tree clean.
17 of 19 block kinds have descriptors; 13 of 17 have real public renderers.
`/about` registry-driven. `/` and `/works` on legacy path.
Publier button with dirty indicator + timestamp live.
