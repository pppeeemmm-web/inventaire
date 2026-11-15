# Design — the work drawer (TODO R3)

Pem 2026-11-14: "so much information that needs to be visually organized … a quicker glance at everything, in a more organized way. That's going to be a big one." Part of the [rethink](./RETHINK_2026-11-14.md). **Design only — nothing built. Step 1 = this inventory + a grouping (answered by Pem 2026-11-15, end of this doc); step 2 = whole-screen mockups (desktop + phone); then build.** Measured on the live catalogue 2026-11-15 (1 182 works), read from live code 2026-11-15 (`components/atelier/work-drawer/DrawerContent.tsx` and its sections).

## What the drawer shows today, top to bottom (desktop, « Tous les champs » on the phone)

1. Header — `#id`, who last changed it, expand, close
2. Pictures — main image, palette, download / retouch, other photos, add a photo
3. Title — large serif field
4. Status line — status, destroyed / lost line, **Production** span (+ start / end fields, admin)
5. **Pipeline** — production stage (Atelier / Disponible / Catalogué), ownership stage (artist, archive, reserved, consigned, loan, sold, gift), custody (owner / custodian / address / buyer), visibility (public / masked / private), « photo needed », « ready to broadcast » + caption seed
6. Sale return window (sold works only)
7. **Identity** — year, technique, support, dimensions / format, framed, presentation, themes
8. **Period & sources** — period (auto or chosen), « Historique de création » (dated lines + places), sources
9. Links to other works
10. Physical label (QR)
11. **Finance** — price, discount, final price, VAT, payment received
12. Costs (admin)
13. Voice notes linked to the work
14. Condition reports
15. Groups
16. Field sessions (+ waiting photos)
17. AI description (rated for usefulness)
18. **Comments + History** (free text)
19. Save bar

On the phone the drawer opens in « field mode » (pictures, title, identity, comments) with « Tous les champs » to see the rest in the same long column.

## How often each part is empty (live, 2026-11-15, 1 182 works)

| Part | Empty for | Note |
|---|---|---|
| Presentation | 1 182 (100 %) | never used |
| Framed | 1 182 (100 %) | never ticked |
| Costs | 1 182 (100 %) | never used |
| Ready to broadcast / caption seed | 1 182 / 1 181 | almost never used |
| Condition reports | 1 181 | |
| Voice notes linked | 1 180 | |
| Price | 1 177 (99.6 %) | |
| Sources | 1 173 (99 %) | |
| Production dates | 1 145 (97 %) | new since 2026-11-01 |
| « Historique de création » | 1 134 (96 %) | new 2026-11-14 |
| Groups | 1 115 (94 %) | |
| Field sessions | 1 110 (94 %) | |
| Comments | 1 080 (91 %) | |
| History | 1 058 (90 %) | |
| Title | 912 (77 %) | « Sans titre » — most works |
| Year | 582 (49 %) | |
| Themes | 577 (49 %) | |
| Dimensions | 359 (30 %) | |
| Support / technique | 76 / 69 (6 %) | |
| Cover picture | 5 | 34 works have more than one photo |
| AI description | 8 | almost every work has one |

States: 828 Disponible, 204 Archive artiste, 143 En production, 7 Gift; 835 public; 79 not catalogued.

## What this says

- **A typical work fills 6–8 of ~60 fields.** It has a picture, a technique and support, often dimensions, a year about half the time, themes about half the time, and an AI description. Almost everything else is empty — yet every empty block takes the same room as a full one, in the same long column. That is the "too much information": mostly **empty frames**, not information.
- **The order follows the database, not the use.** Selling (pipeline, custody, finance) comes before what the work *is* (identity, period, story), and the story is split in four places (creation history in §8, links §9, voice notes §13, sessions §16, comments + history §18).
- **The drawer is always a form.** Every field is an input, even when Pem only wants to look. (Pem's first ask, 2026-11-14: "if a field has no content, fold it … show the box to enter it on click.")
- **Four fields have never been used** (Presentation, Framed, Costs, broadcast caption) — keep, hide, or remove?

## Proposed grouping (to agree before any mockup)

**1. At a glance — always visible, read first (no input boxes):**
- the pictures (main + strip), title, `#id`;
- one identity line: year · technique / support · dimensions;
- one state line: production stage · where it is / who holds it · public or not (chips; a warning chip when something is wrong — waiting photos, destroyed / lost, sale return window);
- period · place made (the route) · themes as chips;
- **« À compléter »**: the missing basics as small tappable chips (« + année », « + dimensions », « + thèmes », « + titre ») — one tap opens just that field.

**2. Four drawers inside the drawer (open one at a time; each header shows a count or a one-line summary, so a closed one still tells something):**
- **Récit / Story** — comments, history, creation history (dates + places), sources, links to other works, voice notes, field sessions, AI description. *(the work's trace — the mission's first aim)*
- **État / State** — pipeline stages, custody, visibility, broadcast, fate, condition reports, physical label.
- **Valeur / Value** — price, discount, VAT, payment, costs (admin).
- **Classement / Organise** — groups (themes stay in the glance).

**3. Empty = one line, not a block.** Inside each drawer, an empty part shows as « + Commentaire », « + Source »…; a tap opens it to fill. Full parts show their content as text; a tap (or ✎) edits that part only — saved like today (the unsaved-changes guard stays).

**Desktop:** two columns — pictures on the left (large, the loupe), glance + drawers on the right; no scrolling past empty blocks. **Phone:** one column, the glance first; the four drawers as full-width rows; the save bar sticky as today.

## Questions for Pem

1. **Read first, edit on tap** (fields become boxes only when touched) — yes?
2. **Four drawers** Story / State / Value / Organise — right names, right content? Is anything in the wrong one?
3. **Never-used fields** (Presentation, Framed, Costs, broadcast caption): hide when empty, or remove from the drawer altogether?
4. **The glance line** — anything missing that you look for first (e.g. price for available works, location)?
5. **Phone:** same drawers, or the phone keeps a shorter « field » set (pictures, title, identity, comments) with the rest one tap away, as today?

## Pem's answers (2026-11-15) — the agreed structure

1. **Read first, edit on tap:** yes.
2. **Missing basics:** no « À compléter » chips — **colour code**: an empty field shows **greyed out** in its place (tap to fill).
3. **Never-used fields** (Presentation, Framed, Costs, broadcast caption): **collapsed**, not hidden or removed.
4. **Layout — one top block + two drawers** (replaces the four-drawer proposal above), with a **collapse / develop switch** for the whole drawer:
   - **Always visible:** pipeline **stages**, colour **swatches**, the **image strip**, **custody and ownership**, **title**, **dimensions**, **technique**, **support**, **period**. « Download » and « replace » become **icons over the image**.
   - **Création** (creative): creation history, sources, links, comments and notes, field-session history, AI description, themes. Voice notes belong here; their transcript should sit in the comments with its reference (date).
   - **Objet** (object): history / provenance (and future tracking), visibility, fate, condition, physical label, presentation (with the pipeline's gates and checkboxes), value, groups (in link with exhibitions / events).
5. **Phone — two uses:**
   - **Recording a new work or a new version** (the field drawer): the same drawer adapted to the phone with fewer fields, mostly inputs — **the picture import**, title, technique, support, dimensions, source, maybe a link, place (recorded automatically, or typed), a note, maybe record a voice note.
   - **Inventory on the phone:** the same as desktop (though Pem prefers the desktop for it).
   - Same colour code: greyed out when empty.
   - **Adding the artwork's picture on the phone: one button, not a choice** (Pem 2026-11-15: "I always use the photothèque to grab the file I've edited in Lr beforehand"). Today the drawer's « + photo » and the session's two buttons (« Prendre une photo » / « Choisir dans la photothèque ») lead to a file input; on the iPhone, Safari itself then shows its own menu (Photothèque / Prendre une photo / Choisir un fichier) — a web page cannot skip that menu or open the photothèque directly. What the design can do: **one button « Ajouter la photo »** (no in-app choice; the camera button goes), so it is one tap + « Photothèque » in Safari's menu. The path with no menu at all stays Lightroom → Partager → PEM (the share target, `CLAUDE.md`).

## Settled with Pem (2026-11-15)

- **Voice transcript:** **copied into Commentaires** with its reference (date) — "usual process" (the audio stays linked to the work as today).
- **Themes:** in Création only — "only creative, not essential to the top block".
- **Collapse / develop switch:** Pem: collapsed shows "the fields in their entirety" — read as: collapsed still lists every field with its full value (no one-line summaries); the mockups show both states so Pem can confirm what the switch folds.
- ~~Price in the top block?~~ Pem 2026-11-15: **the value group** (price, VAT, discount, payment, costs) stays together in Objet.

## Pem's review of today's screens (2026-11-15, screenshots of #2233 at 2 000 px wide) — what not to keep

Facts checked the same night are marked *(checked)*.

**Inventory page**
- **« Filters + »** should open a filter straight away — today it only reveals « + filter », which then has to be clicked again (two steps for one).
- **Sidebar:** too much empty space between the section names and the table's first column (the checkboxes) — reclaim it.
- **« All themes »** select is far too long; shorter, so « All groups » and « All states » move left.
- **Medium** column too wide (dead space).
- **Year** column: « in progress » overflows into the Period column (bug).
- **Broadcast** column: its title is cut, and « embedding waiting » is cut (bug).

**Work drawer — header and pictures**
- The **work number** always visible: in the sticky bar, larger.
- A **yellow diamond** next to the number — Pem doesn't know what it is (it must say what it is, or go).
- Too much space between the expand and close buttons.
- **Download / replace retouched** → icons over the picture (as agreed).
- **« Gift »** in the sticky save bar — still relevant there?
- **Palette** of #2233 shows Grey 84 % / Black 16 % and misses the **red accent** visible in the picture *(checked: the stored palette has only those two colours — the extraction drops a small vivid patch; to investigate)*.

**Production / state**
- Confusing block: « En production », then « Production · Start unknown → 15 Nov 2026 », then « Production ended 2026-11-15 » — in production *and* ended. *(checked: #2233 was catalogued at 01:17 on 15 Nov with « photo required » still on; the database keeps that as status 1, the same number as « En production ». Inventory already says « Catalogued »; the drawer's status line shows the raw label « En production ». The end date is right; the label is wrong.)*
- The help text under « Production started / ended » → beside the fields.
- « Photo required » checked: its explanation → beside the checkbox, not below.
- **Owner / custodian:** the small box that opens the contact drawer is poor and wastes space; the **address** select needs a redesign ("ugly").
- **Contact confidentiality:** explanation → beside the section title; the three buttons are fine.

**Identity**
- **Year vs production dates** seem to conflict (a year-only date is handy, but the two must read as one story).
- Technique, support, dimensions: fine.
- **Framed / Ready for broadcast / Presentation** and their texts: rearrange as in the brief, **with the pipeline's gates** in place.
- **Themes:** total rework — today every theme in the catalogue is shown as a chip; show **only the work's own themes** (the long names take far too much room).

**Period & sources** (weak section)
- « Manage periods and sources » is fine; the period line (« Automatic: Marseille · 13 Jun 2024– ») and the **creation history** need a complete rework.
- Source buttons: fine. **Links to other works:** fine in principle but unclear — weak visual hierarchy.

**Physical label (QR)**
- Explanation → beside the title; « Copy link » / « Print » → beside the QR, not below; the link text too.
- The link must **never be localhost** — always `https://www.thepemworkshop.com/atelier/works/<id>` *(checked: on the live site it is, from `NEXT_PUBLIC_SITE_URL`; on dev that setting is empty, so `lib/atelier/work-physical-bridge-url.ts` falls back to the page's own address — fix: fall back to the public address, never the page's)*.

**Value, condition, groups, sessions, AI, comments, versions**
- **Finances** = the value group (price, discount, VAT, final amount, payment received).
- Condition reports: fine.
- **Groups:** same as themes — show none when none is chosen. Idea (not sure it's needed): a search box to add a theme or group.
- **Linked field sessions:** collapsed by default, always.
- **« Seen by AI »:** colour-coded when it still needs judging / reviewing — visible (e.g. red, or white on black).
- Comments: fine.
- **« Version history » → rename « Data history »** (« version » suggests a reworked work — TODO 6).

### Quick fixes this review found (bugs, not design — can go before the mockups on Pem's GO)
1. Drawer status line says « En production » for a catalogued work waiting for its photo (status 1) — use the Inventory's wording.
2. QR link falls back to the page's address on dev — fall back to the public address.
3. Inventory: Year « in progress » overflows; Broadcast column title and « embedding waiting » cut.
4. « Filters + » opens a filter straight away.
5. « Version history » → « Data history ».
6. Palette misses small vivid accents (#2233) — **rule changed 2026-11-15** (`lib/image-palette.ts` rules 6–8, docs/TODO_NOTES.md « palette-main-colours »): deployed `a825695`; every stored palette recomputed the same day (1 233 / 1 237). Next: regroup the main colours on Pem's wheel (design step).

Next: whole-screen mockups — desktop (a full work, an almost-empty one) + phone (recording a new work; inventory) — then build.
