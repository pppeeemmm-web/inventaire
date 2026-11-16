# Work card (R3) — mockup notes, 2026-11-16

Design only, nothing built. Mockups: [WorkCard.desktop.html](./WorkCard.desktop.html) (overlay 820 px expanded; Inventory side panel 470 px, collapsed + an almost-empty work) and [WorkCard.phone.html](./WorkCard.phone.html) (375 px: recording drawer, inventory top block, Création open while editing). Structure = Pem's answers in [DESIGN_DRAWER](../../DESIGN_DRAWER.md) (2026-11-15). Field inventory read from live code 2026-11-16 (`components/atelier/work-drawer/DrawerContent.tsx` render order, lines 1262–1498): no section added since DESIGN_DRAWER was written.

## Rules shown

- **Read first, edit on tap.** Values are text; a tap turns that one part into inputs (phone 3). Unsaved guard + sticky save bar unchanged.
- **Empty = greyed out in place** (`+ dimensions`, dashed underline, `--mt` colour). No « À compléter » chips.
- **Header:** `#id` large, always visible; « modifié par » small; Replié / Développé switch; expand + close side by side (no gap). The yellow diamond goes.
- **Download / replace with retouch** = icons over the picture; « + » at the end of the image strip.

## Field map — today → new place

| Today (§ in DESIGN_DRAWER) | New place |
|---|---|
| 1 Header: `#id`, last changed by, expand, close | Header (number larger) + Replié / Développé switch |
| 2 Pictures: main, palette, download / retouch, other photos, add | **Top** — picture with ↓ ⟳ icons, strip + « + », swatches |
| 3 Title | **Top** |
| 4 Status line (status label, destroyed / lost line) | **Top** — stages; destroyed / lost → warning chip in Top + **Objet › Destin** |
| 4 Production span (start / end dates) | **Top › Période** line, read with the year (« 2024 · fait 12 juin → 15 nov. 2026 »); edited inside Création › Historique de création — *Q2* |
| 5 Production stage (Atelier / Catalogué / Disponible) | **Top** — 3-step stepper with dates |
| 5 « Photo requise » | **Objet › Présentation** (gate chip) + warning chip in Top when photos wait |
| 5 Ownership stage (artist … gift) | **Top** — chips; « Don… » opens today's gift transfer |
| 5 Custody: owner / custodian / address / buyer | **Top** — one line each, name opens the contact; address after the custodian |
| 5 Visibility (public / masqué / privé) | **Objet › Visibilité**; current value also a chip in Top |
| 5 « Prêt à diffuser » + caption seed | **Objet › Présentation** — caption seed folded (never used) |
| 6 Sale return window | Warning chip in **Top** (sold works only) |
| 7 Year | **Top › Période** |
| 7 Technique, support, dimensions / format | **Top** |
| 7 Framed, presentation | **Objet › Présentation** (folded, never used) |
| 7 Themes | **Création** — the work's own themes only, « + thème » |
| 8 Period (auto / chosen) | **Top › Période** |
| 8 Historique de création (dated lines + places) | **Création** (first part) |
| 8 Sources | **Création** |
| 9 Links to other works | **Création** |
| 10 Physical label (QR) | **Objet › Étiquette** — copy / print beside the QR |
| 11 Finance: price, discount, VAT, final HT, payment | **Objet › Valeur** (one row) |
| 12 Costs (admin) | **Objet › Valeur**, folded (never used) |
| 13 Voice notes linked | **Création › Commentaires & notes** — transcript copied there with date, audio chip links to it |
| 14 Condition reports | **Objet › État · constats** |
| 15 Groups | **Objet › Groupes** (exhibitions / events) — chosen groups only |
| 16 Field sessions (+ waiting photos) | **Création › Sessions de terrain**, always folded; waiting photos → chip in Top |
| 17 AI description | **Création › Vu par l'IA** — rust frame while « à juger », plain once judged |
| 18 Comments | **Création › Commentaires & notes** |
| 18 History (free text) | **Objet › Historique / provenance** |
| 18 Data history (versions) | **Objet › Historique / provenance**, folded link |
| 19 Save bar (+ Gift button) | Sticky bottom: dirty count, Annuler, Enregistrer — Gift moves to the ownership chips — *Q5* |

Nothing is dropped. Phone « field mode » (pictures, title, identity, comments) is replaced by the recording drawer for new works and the full card for inventory.

## Collapsed by default

- **Replié is the default** for the whole card (owner rule): Top block in full; Création and Objet closed, each header showing a one-line summary (« 3 lignes d'historique · 2 commentaires · IA à juger »); all empty fields gathered into one grey line « 11 champs vides … voir ».
- **Always folded, even in Développé:** field sessions, data history, costs, Présentation's never-used fields (presentation, caption seed).
- On the phone the drawers open one at a time.

## Phone recording drawer

Fields: one « Ajouter la photo » button (Safari then offers Photothèque; the share target skips it), title, technique, support, dimensions, place (auto GPS, editable), voice note. Source, link, period behind one « ▸ » line. Switch « Nouvelle / Version de… ». Save bar: Brouillon + « Créer #2241 ».

## Open questions for Pem

1. **Replié** — as drawn: filled fields in full, empties gathered in one line, drawers closed to summaries. Is that what you meant by « the fields in their entirety »?
2. **Year + production dates** — shown together in the Top « Période » line, edited in Création › Historique de création. One story — right?
3. **Visibility** — lives in Objet, but its value shows as a chip in Top. Keep the chip, or Objet only?
4. **Recording drawer** — is « Version de… » (link the new record to an existing work) the right second mode, and which fields hide behind « ▸ »?
5. **« Gift » in the save bar** — move it to the ownership chips (« Don… ») as drawn?
6. **Side panel (470 px)** — picture above, one column; or keep two columns when the panel is wider (expanded 55 vw)?
