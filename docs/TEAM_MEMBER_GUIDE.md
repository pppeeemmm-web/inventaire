# PEM Studio — Team member guide (complete)

**Audience:** You are a **team member** (signed in, `is_team()`), not an **admin**. This document lists **every major function** in Hub and Atelier as of the 2025–2026 release. Admins see extra tabs and actions marked **(admin only)**.

**Languages:** French and English — use the language toggle on the public site or in Atelier desktop chrome.

**Install on phone:** Safari/Chrome → **Add to Home Screen**. The app opens **Hub** (`/hub`) and accepts **Share** from Lightroom or Photos.

---

## Table of contents

1. [Team vs admin](#team-vs-admin)
2. [Navigation and global chrome](#navigation-and-global-chrome)
3. [Shared tools (every tab)](#shared-tools-every-tab)
4. [Hub and field routes](#hub-and-field-routes)
5. [Atelier tabs — Field group](#atelier-tabs--field-group)
6. [Atelier tabs — Studio group](#atelier-tabs--studio-group)
7. [Atelier tabs — Catalogue group](#atelier-tabs--catalogue-group)
8. [Atelier tabs — Commercial group](#atelier-tabs--commercial-group)
9. [Atelier tabs — Public group](#atelier-tabs--public-group)
10. [Atelier tabs — Admin group (partial)](#atelier-tabs--admin-group-partial)
11. [Maps index](#maps-index)
12. [Pending edits and saves](#pending-edits-and-saves)
13. [New features (recent releases)](#new-features-recent-releases)
14. [Troubleshooting](#troubleshooting)

---

## Team vs admin

| Area | Team member | Admin only |
|------|-------------|------------|
| All tabs except Audit / Broadcast | Yes | — |
| **Audit** tab | Hidden | Pending approvals, audit log, version restore, hard purge |
| **Broadcast** tab | Hidden | Social diffusion queue |
| Approve others’ pending work edits | No | Audit → Review |
| **Field session** wizard `/atelier/session/new` | Redirected to **Journal** | Full capture + apply to catalogue |
| Graph **CSV** download (Pivot Atlas) | No | Entités / Arêtes links |
| **Regenerate Studio Bible** | No (may open System tab; action blocked) | Yes |
| **Version history** in work drawer | Hidden | Restore old œuvre versions |
| **Delete work image** permanently | Button may show; **server rejects** | Yes |
| **Delete work session** rows | No | Yes |
| **Private contact** flag | No | Yes |
| Overview **contact conflict** queue | Hidden | Merge queue |
| Share triage **session apply** path | Limited | Full session workflow |

**Editing existing works:** Many drawer saves on works that already exist go to **`pending_changes`** for review instead of applying instantly. **New works**, **batch edit**, and some junction updates apply immediately. You should see feedback when a save is queued.

**Deleting a work:** Team can **soft-delete** (trash) from the drawer with an **Undo** toast (~8 seconds). Permanent purge is admin-only.

---

## Navigation and global chrome

### Entry points

| URL | Use |
|-----|-----|
| `/hub` | Phone launcher, field verbs, field pulse |
| `/atelier/overview` | Default Atelier landing (desktop Hub link goes here) |
| `/atelier/<tab>` | Each tab has its own bookmarkable URL |

Legacy links `/atelier?tab=inventory` still redirect to `/atelier/inventory`.

### Sidebar groups (same order on phone and desktop)

1. **Field** — inventory, production, stock-take, journal, notes, map  
2. **Studio** — overview, pipeline, exhibitions, concepts  
3. **Catalogue** — reports, themes, stock (suppliers), constellation  
4. **Commercial** — sales, logistics, fiscal, vault  
5. **Public** — site, portfolio, analytics  
6. **Admin** — contacts, system *(audit/broadcast only for admins)*

On narrow screens, open the sidebar with **☰**; the header shows the active tab name.

### Header (all tabs)

| Control | Function |
|---------|----------|
| **Hub** link | Back to `/hub` (with unsaved-drawer guard) |
| **Catalogue badge** | Shows **loaded** count vs **total** in database when paging is active |
| **⌘K / Ctrl+K** (desktop) | Command palette |
| **New work** (desktop) | `/atelier/works/new` |
| **Reports / System** shortcuts (desktop) | Jump tabs |
| **Language** FR / EN | Desktop header chrome |
| **Subset banner** (Inventory only) | Warns that list is partial; **Load next batch** |

### Catalogue batches

- First load: one **chunk** of works + exact **total count**.
- **Load next batch** (top strip and/or bottom paging bar) fetches more.
- Stats on Overview, Reports, Themes, Portfolio reflect **loaded works only** unless you load the full catalogue.

### Deep links

| Parameter | Effect |
|-----------|--------|
| `?work=<OeuvreID>` | Opens work drawer, then strips from URL |
| `?exhibition=<id>` | Exhibitions tab selects that project |
| `?map=<uuid>` | Constellation loads cloud map |
| `?contact=<id>` | Contacts tab opens that editor |

---

## Shared tools (every tab)

### Work drawer

Opened from almost any work list, map pin, constellation node, or `?work=`.

#### Chrome

| Function | Description |
|----------|-------------|
| Work ID + attribution | Who last changed the record |
| Close | Triggers unsaved guard if dirty |
| Panel expand/collapse | Wider edit area on desktop |
| **Images** | Gallery, reorder, set cover, zoom/pan |
| Add image | Upload (JPEG/PNG/WebP/GIF/AVIF/HEIC) |
| Retouch / replace | Replace selected image file |
| Delete image | **(admin only)** — team gets error if attempted |
| **QR block** | Printable label linking to public verify URL |
| **Title** | Inline edit at top |
| **Status bar** | Computed status from production + ownership stages |

#### Production pipeline section

| Function | Description |
|----------|-------------|
| Production stages | **Atelier → Catalogued → Available** (progress control) |
| Needs photograph | Toggle; warning when catalogued but still needs photo |
| Ownership stages | **Artist, Reserved, Consigned, Loan, Sold, Gift, Artist archive** |
| Contact | Buyer / custodian / acquirer depending on stage |
| New contact | Modal form from drawer |
| Location | Storage / display location |
| Anonymity level | Public visibility control |
| Locked when sold/gift/archived | Production stages greyed when ownership transferred |

#### Identity section

| Field | Notes |
|-------|--------|
| Year | `YYYY-MM-DD` style date |
| Technique / Support | Dropdown; **type to add** new lookup value |
| Dimensions | H × W × D; circular works use diameter mode |
| Digital works | Pixel dims + cm estimate @300dpi |
| Framed | Toggle |
| Broadcast ready + caption seed | For social pipeline (admin Broadcast tab consumes) |
| Presentation | Dropdown |
| Themes | Multi-select chips |

#### Finance section

| Field | Notes |
|-------|--------|
| Price, discount %, TVA | |
| Final price | Computed |
| Payment done | Toggle when sold |

#### Working groups

Toggle which **working groups** include this work.

#### Work sessions (read-only for team)

List of field sessions linked to this work. Admins manage capture in session wizard.

#### Notes section

| Field | Description |
|-------|-------------|
| Commentaires | Free text |
| Historique | Append-only log lines |

#### Version history

**(admin only)** — not shown to team.

#### Footer actions

| Button | Team behaviour |
|--------|----------------|
| **Save** | New work: immediate. Existing: may → **pending review** |
| **Add photo** (narrow) | Opens file picker |
| **Pipeline bump** (narrow) | Quick advance production stage |
| **Add to selection** / **In selection** | For curation dock |
| **Gift** | Modal: recipient, date, notes (when stage allows) |
| **Delete** | Two-step confirm → soft-delete + **Undo** toast |

#### Sale return banner

When work is **sold**, shows return-window info if applicable.

---

### Command palette — ⌘K / Ctrl+K

| Group | Functions |
|-------|-----------|
| **Actions** | Scan QR · Field note · Reminders · New work · New sale · Stock-take tab · Export XLSX (→ Reports) · Regenerate Bible (→ System; regen admin-only) |
| **Actions (admin only)** | Capture session · Pending approvals |
| **Tabs** | Jump to any tab you can see |
| **Works** | Search title (≥2 chars), up to 6 hits → open drawer |
| **Contacts** | Search name (≥2 chars) → Contacts tab |
| **Semantic** | ≥3 chars: AI meaning search (works + contacts); shows loading / pending / unavailable states |

Keyboard: ↑↓ move, Enter run, Esc close.

---

### Curation dock (when 1+ works selected; hidden on Constellation tab)

| Button | Opens / does |
|--------|----------------|
| Selection count | — |
| **Modify** | **Batch edit** modal |
| **Export** | **Export** modal (HTML/PDF layouts for selection) |
| **Attach** | **Catalog persist** modal (attach themes/groups in bulk) |
| **Compare** | **Compare** modal (side-by-side fields) |
| Group name + **+** | Save selection as new **working group** |
| **Curate →** | Go to Constellation with selection |
| **Clear** | Deselect all |

#### Batch edit modal (applies immediately — not pending queue)

Bulk-update selected works:

- Title, status, technique, support, format, contact, location  
- Price, discount, year, comments, historique append  
- Flags: exposable, montée, encadrée, cataloguée, commission, gift, paid, needs photo, broadcast-ready  
- Add/remove **themes** and **working groups**; create theme inline  

#### Export modal

Export selected works to printable HTML/PDF using chosen layout.

#### Compare modal

Side-by-side: ID, title, year, technique, support, format, dimensions, status, contact, location, prices, flags, confidentiality, commission, notes, history (long text loaded async).

---

### Mobile bottom bar (narrow Atelier, drawer closed)

| Button | Team | Admin |
|--------|------|-------|
| Session | Journal | `/atelier/session/new` |
| Scan | `/atelier/scan` | same |
| Voice note | Opens recorder sheet | same |
| Reminders | Scrolls Overview reminders | same |
| New work | `/atelier/works/new` | same |

---

### Unsaved changes guard

Leaving the drawer, changing tabs, or going to Hub with dirty fields → **Save** / **Discard** / **Cancel**.

---

## Hub and field routes

### Hub — `/hub`

#### Field pulse

| Element | Action |
|---------|--------|
| Metrics (4) | Past due · Today · Pending review *(admin metric)* · Share inbox |
| Tap metric | Deep link (pipeline, inbox, etc.) |
| **Open inbox** | `/atelier/field-inbox` |
| First card | Suggested next action |

#### Field verbs

| Verb | Destination / effect |
|------|----------------------|
| From Lightroom | `/atelier/share-triage` |
| Session | **Journal** (admin: session/new with today’s date) |
| Voice note | `VoiceNoteSheet` modal |
| Scan document | `/atelier/capture?mode=doc` |
| Pipeline | `/atelier/pipeline` |
| New sale | `/atelier/sale/new` |
| Triage | `/atelier/triage` (broadcast stub) |
| Business card | `/atelier/capture?mode=card` |
| Document | `/atelier/documents/new` (stub) |
| Report issue | `/atelier/issue/new` |

#### Studio room tiles

| Tile | Tab |
|------|-----|
| Field | Inventory |
| Studio | Overview |
| Commercial | Pipeline |
| Admin | Contacts |

#### Other

- PWA / Lightroom intro modal (first visit on phone)  
- Optional legacy tile accordion  

**Desktop:** `/hub` may redirect you toward Atelier Overview; use Hub on phone for field verbs.

---

### Field inbox — `/atelier/field-inbox`

| Function | Description |
|----------|-------------|
| Pulse metrics | Same family as Hub |
| Queue cards | Actionable items with links |
| Back | Hub |

---

### Share triage — `/atelier/share-triage`

| Function | Description |
|----------|-------------|
| **Manual import** | Files + title/text/URL → POST share-receive |
| Inbox list | Recent shares |
| Open row | `?inbox=<uuid>` detail |
| Dismiss / delete | Remove inbox row |
| **Attach to existing work** | Search and link |
| **New work** / **Split** | Create one or many drafts → WorkForm with inbox context |
| Single image (phone) | Often auto-routes to new work |
| Return-session banner | After Lightroom round-trip; link shots to session *(admin capture)* |

---

### Share receive — `/atelier/share-receive`

| Method | Behaviour |
|--------|-----------|
| **POST** (PWA share target) | Stores inbox + files → redirect triage |
| **GET** | Redirect triage |

---

### Session — `/atelier/session/new`

| Role | What you see |
|------|----------------|
| **Team** | Gate: “admin capture only” + link to **Journal** |
| **Team** (with `?session=` / draft) | Review/submit-for-review flows — not full apply |
| **Admin** | Multi-shot staging, weather/location, apply images to catalogue, pending review queue |

---

### Create work — `/atelier/works/new`

| Function | Description |
|----------|-------------|
| Full **WorkForm** | All fields + images |
| Save | **Immediate** (not pending queue) |
| From share inbox | Pre-filled import |

---

### Scan — `/atelier/scan`

| Function | Description |
|----------|-------------|
| Camera QR scan | Opens work in drawer |
| Manual ID entry | Type œuvre ID |
| Back | Hub |

---

### Capture — `/atelier/capture`

| Mode | Functions |
|------|-----------|
| Default | Stub + links |
| `?mode=doc` | Multi-page document scan → vault PDF |
| `?mode=card` | Photo or paste text → contact import preview → confirm import |

---

### New sale — `/atelier/sale/new`

| Function | Description |
|----------|-------------|
| Sale order form | Buyer, lines, works, pricing |
| Save | → Sales tab / order detail |

---

### Documents — `/atelier/documents/new`

Stub with links (vault, portfolio) — full COA paperwork flow not shipped yet.

---

### Issue — `/atelier/issue/new`

| Field | Description |
|-------|-------------|
| Form | Maintenance report → `studio_task` |
| Optional work link | Tie to œuvre |
| Severity, notes | |

---

### Triage (broadcast) — `/atelier/triage`

Stub pointing to Broadcast (admin) and share triage — not the same as share triage.

---

## Atelier tabs — Field group

### Inventaire / Inventory — `/atelier/inventory`

| Category | Functions |
|----------|-----------|
| **Views** | **List** (table + side preview drawer) · **Grid** · **Pivot** (inline pivot panel) · Graph placeholder view in code |
| **Search** | Text; paste list of IDs |
| **Quick filters** | Technique, support, status, theme, working group |
| **Advanced filter** | Add criteria (field + operator + value); AND logic; clear all |
| **Sort** | Click column headers (ID, title, year, price, status, stage, contact, custodian, commission, …) |
| **Selection** | Row checkbox · select all filtered |
| **Open work** | Row click → drawer (list view may show embedded preview) |
| **New work** | Header / palette / mobile bar |
| **Embedding badge** | pending / embedding / error on row (informational) |
| **Paging** | Global load-next-batch |
| **Curation dock** | When selection active |

---

### Production — `/atelier/production`

| Function | Description |
|----------|-------------|
| Filtered list | Works in production-related statuses |
| Text filter | Narrow list |
| Material overview | Field issues tied to works |
| Per-work checklist | Toggle production action steps |
| Pivot export | Throughput-style export from tab |
| Open work | Drawer for status, flags, images, location |

---

### Stock-take — `/atelier/stock-take`

| Function | Description |
|----------|-------------|
| Supplier/material rows | Expected vs counted qty |
| Search | |
| Show discrepancies only | Toggle |
| +/- buttons | Adjust counts in UI |
| Apply | Modal → persist corrections to stock |

---

### Journal sessions — `/atelier/journal`

| Function | Team | Admin |
|----------|------|-------|
| Month calendar index | Yes | Yes |
| Select day | View session detail | Yes |
| Intro banner | Explains read-only capture policy | — |
| View session day | `session/new?session=&date=` review | Full editor |
| Browse shots | Thumbs, notes, link to work | Yes |
| Edit session metadata | No | Yes |
| Delete session / items | No | Yes |
| Version compare on items | No | Yes |
| Capture today shortcut | No | Yes |

---

### Notes — `/atelier/notes`

| Function | Description |
|----------|-------------|
| List | All voice notes |
| Filters | Kind, time bucket |
| Search | Transcript text |
| Select row | Play audio, edit transcript, delete |
| Create | Hub, palette, mobile bar |

---

### Carte / Map — `/atelier/map`

| Function | Description |
|----------|-------------|
| Mode toggle | **Contacts** vs **Works** |
| Map | Pan, zoom (Leaflet) |
| Pin click | Contact card or work drawer |
| Geocode | Server-assisted; client cache |

---

## Atelier tabs — Studio group

### Vue d’ensemble / Overview — `/atelier/overview`

| Block | Functions |
|-------|-----------|
| Stats cards | Works this year, priced, available/exposable, missing dims/images/location *(loaded subset)* |
| Financial pulse | Sold revenue this calendar year |
| Recent works | Last 6 by ID → drawer |
| Pipeline calendar | Week view snippet → Pipeline tab |
| Upcoming deadlines | Pipeline reminders |
| Field reminders | Unread `suivi_reminder`; mark read |
| Expenses teaser | Total from bootstrap |
| Burning concepts | Top concepts → Concepts tab |
| Technique breakdown | Top 5 techniques |
| Subset caption | When catalogue partially loaded |
| Conflict queue | **(admin only)** |

---

### Pipeline — `/atelier/pipeline`

| Function | Description |
|----------|-------------|
| Views | Board / list / calendar-style pulse |
| Filters | Process type (sale, exhibition, consignment, loan, shipment, …), group |
| New process | Modal |
| Open process | Steps, deadlines, mark complete, edit dates |
| Exhibition link | Create/open linked **Expositions** project |
| Reminders | Badge, list, mark read, delete |
| Open work / contact | From process row |
| `?calendar=*_ok` OAuth return | Banner in Exhibitions (related) |

---

### Expositions / Exhibitions — `/atelier/exhibitions`

| Function | Description |
|----------|-------------|
| Project list | `type = exposition` processes |
| Select project | Detail workspace |
| Checklist | Per-work `suivi_etape` steps |
| Floor plan | Upload plan, walls, drag works onto plan |
| Schedule / notes | Edit and save |
| Calendar export | Connect Google or Microsoft, push events, disconnect |
| Delete exhibition | Clears pipeline links then deletes row |
| Deep link | `?exhibition=<id>` |

---

### Concepts — `/atelier/concepts`

| Function | Description |
|----------|-------------|
| List | Idea bank before catalogue works exist |
| Filters | Status, category |
| Sort | |
| Create / edit / delete | Concept records |
| Sketch upload | Image on concept |
| Stats | Active, high energy, converted counts |
| Promote to work | Workflow in tab when ready |

---

## Atelier tabs — Catalogue group

### Rapports / Reports — `/atelier/reports`

#### Works table mode

| Function | Description |
|----------|-------------|
| Column picker | Show/hide columns |
| Filters | Search, technique, support, status, theme, group, selection-only |
| Sort | Column sort |
| Subset note | When partial catalogue |
| Export **XLSX** | Spreadsheet of filtered rows |
| Export **PDF** | pdfkit table (row cap) |

#### Pivot Atlas mode

| Function | Team | Admin |
|----------|------|-------|
| Preset **Contacts × Themes** | Grid + export XLSX from widget | Same |
| Preset **Raw edges** | Flat graph edges | Same |
| Pivot toolbar | Dimensions, measures | Same |
| **CSV Entités / Arêtes** | Hidden | Download graph CSV |

---

### Thèmes / Themes — `/atelier/themes`

| Function | Description |
|----------|-------------|
| Theme list | Rename (context menu), delete with confirm, add |
| Working group list | Same |
| Select theme/group | **Mosaic** of member works |
| Analytics panel | Counts on loaded subset |
| Subset note | When partial catalogue |
| Assign works | Via drawer or Constellation (not bulk here) |

---

### Stock fournisseurs / Supplier stock — `/atelier/stock`

| Function | Description |
|----------|-------------|
| Supplier hub | Suppliers, materials, stock levels |
| CRUD | Add/edit suppliers and material lines per UI |
| Link to stock-take | Related physical count tab |

---

### Constellation — `/atelier/constellation`

| Function | Description |
|----------|-------------|
| Layout modes | Year · Theme · Working group · Free / custom |
| Filters | Theme, group, custom subset |
| Pan / zoom | |
| Drag nodes | Position works |
| Edges | Draw link between works; delete edge (context) |
| Overlays | Move tool, marquee, draw, line, text, erase |
| Local snapshots | Save/load in browser |
| Cloud maps | Save, load, delete; share `?map=<uuid>` |
| Open work | Double-click / action → drawer |
| Curation dock | **Disabled** on this tab (selection still used for layout) |

See [`CONSTELLATION.md`](./CONSTELLATION.md) for curator detail.

---

## Atelier tabs — Commercial group

### Ventes / Sales — `/atelier/sales`

| Function | Description |
|----------|-------------|
| KPI strip | Summary stats |
| Order list | Filter, sort |
| New order | Modal or `sale/new` / palette |
| Order detail | Lines, works, buyer, prices, return window, status |
| Sold-works pivot | Export from tab |
| Session storage | `pem_sales_open_new_order` opens new order modal on tab entry |

---

### Logistique / Logistics — `/atelier/logistics`

| Function | Description |
|----------|-------------|
| Tabs / sections | Upcoming vs delivered shipments |
| New shipment | Create row |
| Mark delivered | Row action |
| Edit shipment fields | Per form |

---

### Revenus & Dépenses / Fiscal — `/atelier/fiscal`

| Section | Functions |
|---------|-----------|
| Dashboard | Summary stats, category breakdown |
| Expenses | Add, edit, delete expense rows |
| BNC framework | French tax reference panel |
| Pivot | On expenses; export XLSX |
| Recettes | Revenue from sold works in data |

---

### Coffre / Vault — `/atelier/vault`

| Function | Description |
|----------|-------------|
| Folder tree | Browse document kinds |
| Upload | New files to vault |
| Preview | In-browser where supported |
| Search / filter | Kind, text |
| Multi-select delete | |
| Generate COA | Modal for certificate PDF |
| Link to works | Where document type requires |
| Open Studio Bible | Latest `bible` document PDF |

---

## Atelier tabs — Public group

### Site public / Website — `/atelier/site`

Uses **PortfolioConfigShell**:

| Function | Description |
|----------|-------------|
| Public sections | Configure site structure |
| Copy / labels | Bilingual content |
| Work visibility | What appears on `/works` |
| Theme assignments | Public groupings |
| Preview | Open public site |

---

### Portfolio — `/atelier/portfolio`

Same shell family:

| Function | Description |
|----------|-------------|
| Portfolio sections / collections | |
| Work order | Manual order + theme residual |
| Modes | Display modes per section |
| **Generate portfolio PDF** | Includes **Themes & groups** appendix when graph edges exist |
| Subset note | Partial catalogue warning |

---

### Analytics — `/atelier/analytics`

Same shell — analytics hooks and configuration (not visitor analytics dashboard alone).

---

## Atelier tabs — Admin group (partial)

### Contacts — `/atelier/contacts`

| Function | Description |
|----------|-------------|
| Search / filter | List |
| Open editor | Name, institution, addresses, role, notes |
| Linked works | See relationships |
| Merge duplicates | When conflict flagged |
| Quick create | Inline + drawer “new contact” |
| Business card import | From Hub capture flow |
| Private contact | **(admin only)** |

---

### Système / System — `/atelier/system`

| Function | Team | Admin |
|----------|------|-------|
| Read system ledger | In-app reference MD | Yes |
| Manual log entry | Free-text incident/note | Yes |
| Screenshot attachment | Upload to `ledger/*` | Yes |
| Download site checklist PDF | Yes | Yes |
| Copy SYSTEM_LEDGER.md | Yes | Yes |
| Open Studio Bible PDF | Yes | Yes |
| Regenerate Bible | Blocked / admin | Yes |

---

### Hidden tabs

| Tab | URL | Why hidden |
|-----|-----|------------|
| Audit | `/atelier/audit` | Approvals, audit trail, versions |
| Broadcast | `/atelier/broadcast` | Social queue |

---

## Maps index

### `/maps`

| Function | Description |
|----------|-------------|
| List cloud maps | Saved constellation maps |
| Open | `/atelier/constellation?map=<uuid>` |

---

## Pending edits and saves

| Action | Usually |
|--------|---------|
| **New work** (`/atelier/works/new`) | Saves immediately |
| **Drawer save** on existing work | → `pending_changes` for gated fields |
| **Batch edit** | Applies immediately |
| **Theme/group junction** in batch | Immediate |
| **Constellation edge** edits | Immediate (server actions) |

You cannot open **Audit** to approve your own changes — ask an admin.

---

## New features (recent releases)

| Feature | What you get | How to use |
|---------|--------------|------------|
| Tab URLs | Bookmark every tab | Sidebar or `/atelier/<tab>` |
| Persistent shell | Faster tab switches | Navigate normally; catalogue stays in memory |
| Constellation + graph | Visual + pivot relationships | Constellation + Reports → Pivot Atlas |
| Semantic search | Meaning-based find | ⌘K, type ≥3 chars |
| Embedding badges | Indexing status on Inventory | Wait or tell admin if many errors |
| Pivot Atlas | Contact×Theme matrix | Reports → Pivot Atlas |
| FR / EN | Full UI toggle | Header or landing |
| Share target | iOS/Android Share into app | Export JPEG → Share → PEM Hub |
| Work sessions + Journal | Shooting days | Hub Session → Journal (admin captures) |
| Pending review | Safer edits | Save drawer; wait for admin |
| Portfolio PDF appendix | Themes page in PDF | Portfolio → generate |
| PWA offline | Queue saves without network | Production install only; reconnect to sync |

---

## Troubleshooting

| Problem | Try |
|---------|-----|
| 500 / blank page after dev change | Hard refresh; admin restart dev with clean `.next` |
| Save stuck “pending” | Admin → Audit → Review |
| Semantic search empty | Shorter query; exact title in palette; wait for indexing |
| Share missing from Lightroom | Re-add to Home Screen; share JPEG not RAW |
| Reports don’t match “full” archive | Load all catalogue batches first |
| Delete image fails | Expected for team — ask admin |
| Wrong map pin | Fix contact address or `contact_addresses` row |

---

## Optional reading

| Doc | For |
|-----|-----|
| [`CONSTELLATION.md`](./CONSTELLATION.md) | Constellation curator contract |
| [`PROJECT_SYNTHESIS.md`](./PROJECT_SYNTHESIS.md) | Stack overview |
| [`SITE_MAP.md`](../SITE_MAP.md) | Engineers — all routes |

*Admin-only engineering handoffs are in `docs/archive/`.*
