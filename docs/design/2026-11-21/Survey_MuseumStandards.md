# Survey 1 — the hub against the museum standards (draft, 2026-11-21)

Status: **local draft**. First survey of `BuildingPrinciples.md` §4. Question: the proven systems for recording works of art — what do they ask, what does the hub already do, what is missing, what is not worth copying.

How it was made: three web searches (sources at the end) plus general knowledge of the standards, set against the hub's schema (`lib/types/supabase.generated.ts`), `ARCHITECTURE.md` and the first page of `WORK_CUSTODY_MODEL.md`. **Limits:** the standards' own texts were not read in full; the list of Spectrum's twelve non-primary procedures is from general knowledge (the nine primary ones are confirmed by the search); `CatalogueGaps.notes.md` (which may already plan some of the missing fields) was not read; the live database was not queried.

## 1. The three references, in one line each

- **Spectrum** (Collections Trust, UK; version 5.1): *what a collection must be able to do* — 21 procedures, 9 of them « primary » (the minimum for an accredited museum).
- **CIDOC-CRM** (ICOM; ISO 21127): *how the records hang together* — everything is an **event** that brings together actors, objects, a place and a time-span.
- **CDWA / CCO** (Getty) and the catalogue raisonné tradition: *which fields describe one work* — what a scholar, an estate or a restorer expects to find.

## 2. Spectrum — procedure by procedure

| Procedure | What it asks | The hub today | Verdict |
|---|---|---|---|
| **Primary** | | | |
| Object entry | Log anything that comes in, with a receipt, whoever owns it | Works made by Pem enter at creation. Works or objects of others coming in: order kinds are sale, consignment, loan, gift — all going out (the master plan mentions « Confié »; not seen in the kind list of `work_order.sql`) | **Check**: is « something of someone else's is in my studio » covered? |
| Acquisition and accessioning | A unique number, a formal record of title | `OeuvreID`, owner = Pem by rule | Covered |
| Location and movement control | Where each object is **now**, and a **history of every move** with date and who | Owner, custodian, address enforced by the database. Where inside the studio: not recorded (designed, master plan §15.2). History of moves: only inside version snapshots and `Historique` lines — no list « where has #1234 been » | **Gap**: the location inside the studio; a readable movement history (a read over versions may be enough) |
| Inventory | Periodically confirm each object is where the record says (« seen on ») | Stock-take exists for supplies; nothing for works | **Gap**: a « seen » stamp per work — falls out of the QR scan in the storage design |
| Cataloguing | The describing record | Strong (1,182 works, images, descriptions, themes) | Covered; fields in §4 |
| Object exit | Log anything that leaves, with a signature | Orders with papers, shipments in steps | Covered |
| Loans in | Borrowing from others | Not seen | Not needed unless Pem borrows works; note only |
| Loans out | Lending, with agreement, dates, condition out and back, insurance value | Loan and consignment orders, `event_work` (condition out / back stamps), `insurance_value` per line | Covered — strong |
| Documentation planning | A plan for the records themselves | `docs/`, the runbook to come | Covered when the runbook exists |
| **Others** | | | |
| Condition checking and technical assessment | Dated examinations | `condition_report` (grade, examiner, action) | Covered |
| Collections care and conservation | **Treatments** done: who, what, with what materials, before / after | A report has an `action` and its status; no treatment record as such | **Gap, small**: a treatment is an event on the work (kind « treatment ») with its paper |
| Valuation | Values **with date, who valued, why** — a history | One price (`Prix`, `PrixFinal`), an insurance value on order lines; no history | **Gap**: a dated valuation line; the insurer's list needs it |
| Insurance and indemnity | The policy, what is covered | `insurance_claim` only | Gap, already in master plan §14.2 |
| Emergency planning | What to save first, where it is, who to call | Nothing (the roof risk, H2) | **Gap, no build**: a printed priority list from the hub + the storage map |
| Damage and loss | Record and respond | Fate rule, condition reports, claims — one source, enforced | Covered — strong |
| Deaccessioning and disposal | Formal exit from the collection | Sale, gift, destroyed, lost — each with its paper | Covered |
| Rights management | For each work: who holds which rights, licences granted, their terms and end dates | Nothing | **Gap**: Pem holds the rights by default; licences granted are office facts (who × work × when × kind × paper) |
| Reproduction | Each reproduction made or authorised, where it was used | Broadcast log (`oeuvre_broadcasts`); image files; nothing for print or third-party uses | **Gap**: the « posted » record of master plan §11 is the first piece; same shape as a licence |
| Use of collections | Each use: shown, published, studied | Events (`event_work`), kits, broadcast | Mostly covered; **literature / press per work** missing (§4) |
| Collections review | Periodic look at the whole | Reports, pivots | Covered |
| Audit | Checking the records against reality | `checks:live`, integrity scripts | Covered for data; the physical side = Inventory above |

## 3. CIDOC-CRM — the shape

The standard's core: an **event** links **actors** (with a role), **things**, a **place** and a **time-span**. A work's life is the chain of its events: made, modified, moved, changed custody, changed ownership, examined, treated, shown, damaged, destroyed. Dates are spans, never bare instants.

| CIDOC-CRM | In the hub |
|---|---|
| Production (who made what, when, where, with what) | `work_creation_step` (date + precision, place, kind), production dates with precision |
| Transfer of custody / acquisition (change of owner) as separate events | The custody model: owner, custodian, address kept apart — **already the standard's distinction** |
| Move | An address change inside a version snapshot — no event of its own |
| Condition assessment, modification (treatment) | `condition_report`; treatment missing |
| Time-span with precision | `*_precision` columns on dates — already done |
| Actor with a role in an event | `event_contact`, order buyer / holder; elsewhere a bare contact id |
| One event shape for everything | **No**: orders, events, kits, shipments, journal entries each have their own shape — the master plan's « Moment » |

**What this says about the master plan:** the « Moment » idea is not an invention to test; it is the field's standard. The plan's two tiers (lifecycles keep their tables; one table for simple dated facts) are a sound way to adopt it without throwing the guards away. What the standard adds: (1) a **move** and a **valuation** are events too, and belong in the same family; (2) the creative side is the same shape — a journal moment is an event with Pem as actor, optionally about a work, at a place — so **one way of reading a timeline serves both halls**, kept apart by what each view may show.

**What not to copy:** the full model (81 classes, 160 properties) is for exchanging data between museums. The hub needs its idea — event, actor with role, thing, place, time-span — not its vocabulary. A later export in that vocabulary stays possible if the shape is respected.

## 4. Fields on one work — what a catalogue raisonné and a restorer expect

| Expected | The hub | Verdict |
|---|---|---|
| Number, title, date (with precision), dimensions, technique, support | Yes | Covered |
| **Materials and making in detail** | `Technique` / `Support` only | Gap → remark with the kind « materials / making » (decided 2026-11-21) |
| **Signature, inscriptions, marks, labels on the back** (where, what it says) | No field found on the work | **Gap**: the first thing an expert checks for authenticity |
| Edition / state (for multiples) | Not built; design settled (one row per copy) | At the first edition |
| Provenance (chain of owners with dates) | Orders + `Historique` lines; no generated line | Read to write: provenance = the work's ownership events in order |
| Exhibition history | `event_work` | Covered; needs title, venue, dates, catalogue number per showing — to check |
| **Literature / bibliography** (where the work was published or discussed) | `work_source` is a list of names (sources of the work, not writings about it) | **Gap**: a publication is a thing; « this work appears in it, page N » is a link |
| Related works (study for, pendant, series) | `tblrelations` with types | Covered |
| Condition and treatment history | Condition yes, treatment no | See §2 |
| Current location / owner, credit line | Custody model; anonymity level | Covered |
| Rights statement | No | See §2 |
| Images with their own record (date, photographer, rights) | `tblImage` (date added, hash, palette) | To check: photographer and rights per image |

The guides for artists agree on one more point, which is the hub's own aim: **record as you go** — the history of a work is built at the moment things happen, not reconstructed later. That is the Journal stream.

## 5. What to take from this — for the map, not a build list

1. **Adopt the event shape as the rule** for anything that happens to a work or with a person (commandment 8 already says it; this is its source).
2. **Six missing kinds of record**, each a kind inside existing homes, none a new screen by itself: move (with « seen on »), valuation, treatment, licence / reproduction, literature, inscription / signature. Each to be told as a scenario before any build.
3. **Two more gaps (Pem 2026-11-21: « I don't think there's anything about this for now »; not re-checked in code):** something of someone else's entering the studio (object entry); the details of each showing of a work — title, venue, dates, catalogue number. Both join the six of point 2: eight kinds of record to place on the map.
4. **Nothing to remove:** custody, loans out, damage and loss, exit papers and date precision already match or exceed the standards.
5. **Not worth copying:** the standards' vocabularies and museum-only procedures (loans in, accession committees).

## Sources

- Spectrum — Collections Trust primary procedures, via: https://www.museumsgalleriesscotland.org.uk/advice-article/collections-management-accountability-and-ethics/ · https://www.museumsassociation.org/museums-journal/news/2022/09/revised-spectrum-guidance-aims-to-move-away-from-gatekeeper-mindset/
- CIDOC-CRM — https://cidoc-crm.org/cidoc-crm/ · https://cidoc-crm.org/html/cidoc_crm_v7.1.html
- Getty CDWA / CCO — https://www.getty.edu/research/tools/vocabularies/documenting_works_cona_cco_cdwa.pdf · https://www.getty.edu/research/institute/standards/cdwa/definitions.pdf
- Catalogue raisonné contents — https://research.lib.buffalo.edu/art/catalogue-raisonne · https://www.artuk.org/artdetective/about/cataloguing-and-records
- Artists' archives — https://www.joanmitchellfoundation.org/uploads/pdf/CALL-Workbook-Dec2013.pdf · https://www.artworkarchive.com/blog/what-and-why-should-artists-archive-their-work
