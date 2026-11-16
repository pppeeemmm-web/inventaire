# Work card (R3) — mockup notes, 2026-11-16 (v2)

Design only, nothing built. Mockups: [WorkCard.desktop.html](./WorkCard.desktop.html) (overlay 820 px expanded; Inventory side panel 470 px, collapsed + an almost-empty archive work) and [WorkCard.phone.html](./WorkCard.phone.html) (375 px: recording drawer — « Nouvelle œuvre » and « Reprise » —, inventory top block, Création open while editing). Structure = Pem's answers in [DESIGN_DRAWER](../../DESIGN_DRAWER.md) (2026-11-15). v2 = Pem's annotations + answers, same day; v3 = Pem's second answers (end of file). Field inventory read from live code 2026-11-16 (`components/atelier/work-drawer/DrawerContent.tsx` render order 1262–1498, footer 1515–1640, save payload 840–870).

## Rules shown

- **Read first, edit on tap.** Values are text; a tap turns that one part into inputs (phone 3). Unsaved guard + sticky save bar unchanged.
- **Empty = greyed out in place** (`+ dimensions`, dashed underline, `--mt`).
- **Hover captions everywhere** (Pem): every chip, gate, stage and short label carries a one- or two-line explanation on hover (long-press on the phone, ⓘ where a hover can't exist). Examples drawn open: « 1 photo de session à valider », « Don… », « Prêt à diffuser », the closed « Disponible » on an archive work. Build: one `title`-like caption component, copy in the i18n module, no caption = lint warning.
- **Compact rows, never a horizontal scroll** (Pem 2026-11-16): each part is one tight row under its divider (dividers kept); a part's explanation is a hover ⓘ beside its title, not a second line; nothing in the card may scroll sideways (long text wraps, grids shrink); vertical scroll kept short by this density.
- **Sticky save bar, always there:** Annuler (discard changes) + Enregistrer at the bottom of the card on every state, greyed while nothing changed; the unsaved-changes guard stays. Permanent delete stays in Objet › Zone admin (admin, never in the sticky bar).
- **Compact controls** (Pem 2026-11-16: « efficient and space-minded »): chips and gates are one fixed height (24 px desktop; on the phone 32 px inside a 44 px tap row), text centred, never stretched to the row height; round chips kept for choices.
- **Colours = the app's:** production stages Atelier rust · Catalogué yellow · Disponible sage (`PROD_STAGE_COLOR`, `lib/work-editor-model.ts`), ownership cyan, logistics dust, warnings yellow.
- **Header:** `#id` large, always visible; « modifié par » small; Replié / Développé; ☆ add to selection; expand; close. **No « ⋯ » menu** (see below).
- **Pictures:** ↓ download, ⟳ replace with retouch, 🗑 delete photo (admin) as icons on the picture; thumbnails carry a ⠿ grip — drag to reorder (today's `reorderWorkImages`), first = cover; « + » at the end. Swatches show their **hex code + share** under each colour.
- **Side panel (Pem: see the whole picture, full detail, same zoom):** the picture is always whole, letterboxed, never cropped; a click opens the loupe as today; ⤢ widens the panel to two columns (picture left, like the overlay). Halfway between the old drawer and the loupe preview — to try in the build.

## Field map — today → new place

| Today | New place |
|---|---|
| Header: `#id`, last changed by, expand, close | Header (number larger) + Replié / Développé |
| « ⋯ » more actions: add to selection, gift, delete | ☆ in header · « Don… » ownership chip · Objet › Zone admin « Supprimer définitivement… » |
| Phone footer « → » pipeline bump | Tap the next production stage (stages are the buttons) |
| Pictures: main, palette, download / retouch, delete photo, other photos (order), add | **Top** — icons on picture, draggable strip + « + », swatches with hex |
| Title | **Top** |
| Status line; destroyed / lost line | **Top** — stages; destroyed / lost → warning chip in Top + **Objet › Destin** |
| Production span (start / end, « found » origin) | **Top › Période** « commencée … · terminée … »; edited in Création › Historique de création |
| Production stage | **Top** — 3 coloured stages with dates |
| « Photo requise » (`NeedsPhotograph`) | **Top › Catalogué stage** (« Catalogué · photo requise » → « photo ✓ ») — see « Needs photo » below; session photos waiting = separate Top chip « N photo(s) de session à valider » |
| Ownership stage (artist … gift, archive) | **Top** — cyan chips; closed choices greyed with a caption why |
| Gift transfer (footer button, `GiftTransferModal`) | « Don… » chip — keeps the override: ownership moves on the signed deed, used by the coming dossiers |
| Custody: owner / custodian / address / buyer, new contact, contact quick view | **Top** — names are links ↗; hover card: address, « Fiche ↗ », « Changer… », « Adresse ▾ » |
| Contact confidentiality (public / masqué / confidentiel, `anonymity_level`) | **Objet › Confidentialité du contact** (v1 wrongly called it « Visibilité ») |
| Work public state (`is_public`, set by triggers) | **Top** — read-only chip « Publique » + caption |
| Montée / Encadrée / Exposable (`prod_tab_field_*`, edited in Production today) | **Objet › Présentation** gates, with Prêt à diffuser. « Cataloguée » = the Catalogué stage itself (same `Catalogué` flag) → not repeated as a gate |
| « Prêt à diffuser » + caption seed; Presentation; Framed | **Objet › Présentation** — caption seed + presentation type folded (never used) |
| Sale return window | Warning chip in **Top** (sold works only) |
| Year · technique · support · dimensions / format (40 F) | **Top** |
| Themes | **Création** — the work's own themes only |
| Period (auto / chosen) + sources (`WorkPeriodSourceSection`) | **Création › Période & sources** — picker + « gérer les listes ↗ » (`PeriodSourceManager`); period value also in Top |
| Historique de création | **Création** |
| Links to other works | **Création** |
| Comments | **Création › Commentaires & notes** |
| Voice notes linked | **Création › Commentaires & notes** — transcript copied with date, audio chip |
| Field sessions (+ waiting photos) | **Création › Sessions de terrain**, always folded; waiting count → Top chip |
| AI description | **Création › Vu par l'IA** — rust frame while « à juger » |
| History (free text) + data history | **Objet › Historique / provenance** (data history folded) |
| Shipments (`shipment` / `shipment_work`: kind, status packed → delivered, dates, recipient) — not in the drawer today | **Top** chip when one is open (« Planifié → Encadreur · 20 nov. ») + **Objet › Logistique** with link to Logistique |
| `Oeuvres.DateLivraison` / `ReturnDate` — not in the drawer today | **Objet › Logistique** (Pem: everything about the work lives in the card; Logistique tab shows them too) |
| `IsCommission` — not editable in the drawer today | **Objet › Valeur** « Commande » + client (in the card now). Wiring it to the commercial pipeline waits for the docket overhaul (sales, gifts…) — not in R3 |
| Finance: price, discount, VAT, final HT, payment | **Objet › Valeur** |
| Costs (admin) | **Objet › Valeur**, folded |
| Groups | **Objet › Groupes** |
| Condition reports → fate | **Objet › État · constats**, then **Destin** right after (connected) |
| Physical label (QR) | **Objet › Étiquette physique**, last |
| Save bar, unsaved guard, draft restore, offline save queue, upload retry | Sticky bottom bar (unchanged behaviour); « Gift » leaves it |

**Function re-check (point 14):** every function in the live drawer has a place above, and three things not in the drawer today join it (shipments, delivery / return dates, commission).

**Add a new value inline — kept everywhere (Pem v3):** technique, support and format selects end with « + Nouveau … » (`saveLookup` → `createLookup`, today); creation-history places « + lieu » (`savePlace`); sources and periods via the picker + « gérer les listes ↗ » (`PeriodSourceManager`); themes and groups « + thème / + groupe ». Same on the phone recording drawer (drawn open on Support).

## Collapsed by default

- **Replié** (confirmed by Pem): Top block in full; Création and Objet closed to a one-line summary; all empty fields gathered into one grey line « N champs vides … voir ». Default state.
- **Always folded, even in Développé:** field sessions, data history, costs, the never-used Présentation fields.

## Phone recording drawer

Two modes (Pem v3: a paint-over is not a « version », it is a new work):
- **Nouvelle œuvre** — new number: « Ajouter la photo » (one button), title, technique, support, dimensions, place (auto, editable, « + lieu »), voice note; behind « ▸ »: source, period, and « peinte sur l'ancien support de… » — a link to the old work when the support is reused.
- **Reprise d'une œuvre** — Pem reworks a work: pick it, add the picture (end of the strip) and a « Reprise — date » line in Historique de création, place, note. **Same number.** Stage does not move by itself.

## Rules the build must enforce (point 9)

- **Stage vs ownership:** Archive artiste cannot be Disponible (stage stops at Catalogué; « Disponible » greyed + caption). Sold / gift close the stages that make no sense.
- **Custodian vs archive:** an archive work's custodian is the artist, set automatically.
- **Place vs date:** a creation-history place is only offered for dates when it existed (places carry a from / to); « commencée 2014 · atelier rue Mazenod » is refused if that atelier opened later.

## Retours Pem 2026-11-16

| # | Pem | Change |
|---|---|---|
| 1 | Keep old colour coding | Stages rust / yellow / sage, ownership cyan |
| 2 | Formats (40 F) nice | Kept |
| 3 | « Commencée » wording | « commencée 12 juin 2025 · terminée 15 nov. 2026 » |
| 4 | Reorder pictures? | ⠿ grip on thumbnails, drag shown |
| 5 | Hex codes | Hex + share under each swatch |
| 6 | Missing Montée etc. | Présentation gates: Montée, Encadrée, Exposable, Prêt à diffuser; photo + catalogue = the Catalogué stage (v3) |
| 7 | Label last; constat + fate connected | Objet order: … État · constats → Destin → Étiquette |
| 8 | « Quelle photo en attente ? » | « 1 photo de session à valider » + caption |
| 9 | Consistent sample data | #2233 dated 2025 at a named atelier; #1418 archive = Catalogué, custodian Pem; rules above |
| 10 | Captions on hover | Rule + 4 open examples |
| 11 | Reach the contact | Owner / custodian links ↗ + hover card (fiche, changer, adresse) |
| 12 | Shipping status | `shipment` chip in Top + Objet › Logistique |
| 13 | Manage periods and sources | Création › Période & sources, « gérer les listes ↗ » |
| 14 | Keep all functions | Map re-checked; 2 left to decide (above) |
| 15 | New version = add the picture? | Reprise = same number, add the picture; paint-over = new work linked to the old support |

## Pem's answers to v1's questions (2026-11-16)

1. Replié as drawn — **ok**.
2. Year + production dates as one story — **yes**.
3. Visibility chip in Top — **ok** (note: the Top chip is the work's public state; the Objet buttons are contact confidentiality).
4. Recording modes / « ▸ » — « do what's best » → three modes above; source + period behind « ▸ ».
5. Gift into ownership chips — **yes**, keep the gift override. « ⋯ » questioned → removed, its three items placed.
6. Side panel — whole picture + loupe, ⤢ for two columns (proposal above).

## Pem's second answers (v3, 2026-11-16)

- **Commission** = an order → commercial → **Objet › Valeur** (« Commande »), in the card with R3; not a Production thing. Its link to the commercial pipeline belongs to the coming docket overhaul (sales, gifts…), not now.
- **Delivery / return dates** → in the card (Objet › Logistique); the Logistique tab shows them too. Shipments: in the card too.
- **Side panel picture** → try straight in the build.
- **Contact confidentiality** — named so everywhere; no « visibilité » wording near it.
- **Paint-over** = a new work, linked to the old support; « Nouvelle version » mode removed.
- **Inline « + nouveau »** for technique, support, place, source… kept (above).

### Needs photo — how it works (live code, `production/_components/Production.tsx` 160–195)

Ticking « Cataloguer » sets `Catalogué` + `NeedsPhotograph` (status stays 1) and creates a « Photographier » task; ticking that task clears `NeedsPhotograph` and moves the work to Disponible. Unticking « Photo requise » in the drawer does the same by hand. In the new card this is the **Catalogué stage**: « Catalogué · photo requise » (yellow, caption: « Photographier l'œuvre — la photo validée la fait passer en Disponible ») → « Catalogué · photo ✓ ». Proposal: adding or validating the main picture in the card ticks it too.

## Settled with Pem (v3, 2026-11-16)

- **Exposable** = physically ready to show (mounted / framed / varnished); **Disponible** = the record is ready (catalogued + photo). Confirmed. Build: the Exposable caption says so.
- **Cataloguée** = the Catalogué stage itself; not repeated in Présentation. Confirmed.
- **Needs photo** on the Catalogué stage, cleared by the Photographier task or by adding / validating the main picture in the card. Confirmed.

## For the main session

- `docs/TODO.md` item **6** (« Rework on the same work = a « Reprise » line … ») — Pem 2026-11-16: remove; it is now part of R3 (recording drawer « Reprise d'une œuvre » mode). `TODO_NOTES.md#work-or-version` stays as the reference.

**Approved by Pem 2026-11-16 — « good to go ».** Nothing open on R3; next step is the build.
