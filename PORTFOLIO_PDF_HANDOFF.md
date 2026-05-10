# Portfolio PDF — handoff

Session goal: replace the interactive `/portfolio` book with a **PDF download** driven by the atelier Portfolio tab data. PDF must be the source of truth, atelier the engine.

Paste/`@`-attach this file when opening a new chat.

## Status — 2026-05-10 21:35 UTC+2

PDF generates and downloads successfully from the landing page popup. **Engine wiring is still wrong** — cover image and section order are pulled from the wrong atelier source. Visual styling of cover/work pages partially fixed (alpha-hex bug). Several open issues.

## Architecture (current)

```text
LANDING (/)
└─ [ Portfolio PDF ] button (bottom-left)
   └─ LandingPdfPopup.tsx (3 preset buttons: galerie / collectionneur / presse)
      └─ server action generatePortfolioPdf(opts)

ATELIER (/atelier → Portfolio tab)
└─ ↓ PDF button (header toolbar)
   └─ PdfExportDrawer.tsx (preset + format + lang + content toggles)
      └─ server action generatePortfolioPdf(opts)

SERVER ACTION (app/atelier/portfolio/pdf-action.ts)
├─ loadPortfolioConfig() → reads JSON from R2 (portfolio_sections.json)
├─ loadPublicWorks()     → Supabase: Oeuvres WHERE is_public=true + Technique + tblTheme + OeuvreTheme
├─ resolveSections()     → tries raw.sections → works_modes[0].collections → works_collections,
│                          picks FIRST source that claims ≥1 work
├─ prefetchImages()      → sharp: AVIF/etc → 2100px JPEG 92 + texture crop (concurrency 4)
└─ buildPortfolioPdf()   → pdfkit: cover → about → [section title → works] → practice → contact
```

## Files

### Created
- `lib/portfolio-pdf-types.ts` — `PdfRequestOptions`, `PdfPreset`, `PdfSection`, `PdfPortfolioConfig`, `PRESET_DEFAULTS`
- `components/portfolio/LandingPdfPopup.tsx` — landing 3-button popup
- `components/portfolio/PdfExportDrawer.tsx` — atelier full-options drawer (rewritten — no longer takes works/collections props; server fetches)
- `app/atelier/portfolio/pdf-action.ts` — self-contained server action (rewritten)

### Edited
- `app/page.tsx` — `[ Portfolio PDF ]` link bottom-left, mounts `LandingPdfPopup`
- `components/atelier/PortfolioTab.tsx` — `↓ PDF` button replaces `/portfolio` link, mounts `PdfExportDrawer`
- `components/public/PublicNav.tsx` — removed `/portfolio` link + `'portfolio'` active type
- `lib/public-site-paths.ts` — removed `/portfolio`
- `lib/i18n/dictionary.ts` — removed unused `pub_portfolio_*` keys

### Deleted
- `app/portfolio/page.tsx`
- `components/portfolio/PortfolioClient.tsx`
- `tests/portfolio-book.spec.ts`

## Key data shapes

```ts
// PortfolioConfig (atelier-edited, stored as portfolio_sections.json on R2)
{
  general:  { artist_name, contact_email, instagram, phone, media_tagline_fr/en, about_intro? }
  about:    { intro_fr, intro_en, statement_doc_id?, cv_doc_id? }
  practice: { approach_fr, approach_en, themes[], materials_fr/en }
  sections:          CollectionItem[]   // Portfolio tab (simple list)
  works_collections: CollectionItem[]   // legacy mirror of works_modes[0].collections
  works_modes: [{
    id, label_fr/en, is_active, sort_order,
    collections: CollectionItem[],
    outro_fr/en,
  }]
}

// CollectionItem
{
  id, title_fr/en, intro_fr/en, description_fr/en,
  theme: string | null,
  sort_order,
  is_active,
  manual_work_order: number[]  // OeuvreIDs in user-chosen order
}
```

## Section resolution priority (current)

1. `raw.sections`
2. `raw.works_modes[0].collections`  ← **user actually edits here (Pürinos collection)**
3. `raw.works_collections` (legacy)

For each candidate, run `buildSectionsFrom()`. First candidate that produces ≥1 claimed work wins. If all fail → single virtual `__all__` section with all public works in DB order.

Diagnostic logs (visible in `npm run dev` console):
```text
[portfolio-pdf] source "sections": N collections → X works claimed
[portfolio-pdf] source "works_modes[0].collections": M → Y
[portfolio-pdf] using source: <winner>
[portfolio-pdf] final sections: [{ id, title, works }]
```

## Open issues / next steps

1. **VERIFY** — user hasn't tested latest resolver patch yet. Awaiting regenerated PDF + server console log. Confirm `using source: works_modes[0].collections` for the Pürinos collection.

2. **Cover image work selection** — currently `allWorks.find(w => imageMap.has(w.OeuvreID))` picks the first work with a loaded image, in section flatMap order. If the user's first section's first work fails to fetch from R2, the cover may show a different work. Consider explicit `cover_work_id` field in atelier config OR pin to first section's first work even if image fails.

3. **Cover dim band** — fixed at 22% height bottom, 55% opacity (was 45% / 100%). User said previous was "too high and too strong" — current may need further tuning based on visual review.

4. **Work page overlays** — top 50% at 7% opacity (subtle vignette), bottom 45% at 80% opacity. May need adjustment.

5. **Section title pages** — not yet visually inspected. They render when a section has `title || description || intro`. Layout: eyebrow "COLLECTION" + section title (28pt bold) + intro/description body (11pt italic).

6. **Practice page placement** — currently AFTER all work pages (before contact). User may prefer it after about page. Verify intent.

7. **Long text overflow** — `drawTextPage` uses `doc.text(body, x, y, { width, lineGap })` with no `height`, so pdfkit auto-paginates. About page with full CV likely spans 2+ pages. Verify visually.

8. **AVIF** — NOT a problem. sharp 0.34.5 has libheif 1.20 → AVIF input works. Texture strip rendering proved decode works. (Previous concern was misdiagnosis of the alpha-hex bug.)

## Critical bug discovered + fixed

**pdfkit does NOT support 8-char alpha hex** (`#RRGGBBAA`). It silently parses the last 6 bytes as RGB, giving wrong colors. E.g.:
- `#00000066` → RGB(0, 0, 102) = navy
- `#000000aa` → RGB(0, 0, 170) = royal blue
- `#000000cc` → RGB(0, 0, 204) = bright blue

Replaced ALL alpha-hex with `doc.fillOpacity(N).rect(...).fill('#000000').fillOpacity(1)`. Always reset to 1 after to avoid bleeding into later draws.

## Verification

- `npm run lint` ✅ (no new warnings in touched files)
- `npx tsc --noEmit` ✅ (touched files clean; pre-existing errors in unrelated files remain — see `app/atelier/page.tsx`, `analytics/actions.ts`, etc.)

## Worktree note

`modest-zhukovsky-442f52/` worktree has stale copies of the old types — tsc complains about it. Per CLAUDE.md run worktree cleanup at session end: `git worktree remove --force <path> && git branch -D <branch> && git worktree prune`.

## Quick commands

```powershell
# Regenerate test PDF (must have dev server running)
# - open / in browser
# - click [ Portfolio PDF ]
# - pick a preset → PDF downloads to ~/Desktop

# Inspect PDF page count without opening
$path = "$env:USERPROFILE\Desktop\pierre-emmanuel-moulin_portfolio_galerie_*.pdf"
$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $path | Select-Object -First 1))
$text = [System.Text.Encoding]::Latin1.GetString($bytes)
[regex]::Matches($text, '/Type\s*/Page\b').Count

# Copy PDF into workspace for preview in Cursor (tomoki1207.pdf extension installed)
Copy-Item "$env:USERPROFILE\Desktop\pierre-emmanuel-moulin_portfolio_galerie_*.pdf" "scratch\portfolio_latest.pdf" -Force
```

## Project rules reminders

- CAVE-CLAUDE: short caveman replies, no autonomy without explicit GO, surgical KISS edits.
- `npm run lint` mandatory before finishing.
- Workspace path is the real app. No worktree copying needed for this task.
- Never edit `Oeuvres.is_public` (trigger), `Oeuvres.txtImageNameLink` (trigger).
