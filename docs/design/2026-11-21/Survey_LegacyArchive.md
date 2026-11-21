# Survey 3 — legacy and the archive that outlives the app (draft, 2026-11-21)

Status: **local draft**. Question: what makes an artist's archive usable by someone else, decades later, without this software. Made from two web searches (sources at the end) plus general knowledge of digital preservation, set against the header of `scripts/archive-export.mjs`. Not done: the archive was not run or opened; the Library of Congress format tables were not read (the search reached only their index); the private legacy plan is Pem's and is not part of this.

## 1. What the field says

- **Estates fail on the inventory, not on the art.** The artists' estate guides (Joan Mitchell Foundation's CALL workbooks, written for artists and for attorneys and executors) put the same thing first: a complete inventory with images, locations and values; then the papers; then who has authority.
- **« There is no one perfect way »** (a Motherwell estate case study) — but someone trained should be able to pick it up: standard fields, plain formats, a written guide.
- **A will that does not name the works, the rights and the archive** leaves them undefined — a lawyer's matter, outside the hub.
- **Preservation rule of thumb** (general knowledge): open, documented, widely used formats; no format that needs one vendor's software; several copies in different places (3-2-1); a written description of what each file is; check the copies periodically.

## 2. The hub's archive against that

`npm run archive` writes a folder readable without the app (from the script's own header):

| Piece | Format | Durability |
|---|---|---|
| `index.html` — every work, searchable, with its journal entries | HTML | Good: opens in any browser, now and later |
| `works.csv` — one line per work, labels spelled out | CSV | Good: the most durable table format |
| `journal/YYYY.md` | Plain text | Good |
| `data/json/*.json` — every table, complete | JSON | Good; needs a description of the tables to be understood by a stranger |
| `vault/` — certificates, orders | As stored (PDF expected) | Good if PDF; PDF/A is the archival variant — not checked |
| `images/` — every image as in the catalogue | **AVIF** (thumbs are `.avif`; the catalogue stores AVIF) | **The weak point**: AVIF is recent; JPEG, PNG and TIFF are the formats archives rely on. Today it opens everywhere; in thirty years it is less certain than JPEG |
| Voice notes (audio) | Not seen in the script's header | **To check**: are the audio files exported, and in which format? |
| `private/` — contacts | — | Kept apart: right |
| `LISEZ-MOI.txt` | Text | Right; to extend (below) |

## 3. Gaps

1. **Images in a durable format.** The catalogue images are AVIF derivatives; the originals exist in one copy (risk accepted by Pem 2026-11-20). For the archive: add a JPEG copy of each image at export, or keep the originals with it. Decide with Pem; no build before that.
2. **Audio.** Check that voice recordings are in the archive; the transcript is text, the voice is the trace.
3. **A stranger's guide.** `LISEZ-MOI.txt` says what is what; an heir or an archivist also needs: what each status means, how to read ownership and custody, how numbering works, where the physical works are (the storage map), how authenticity is checked. This is the introduction package (FR + EN) Pem wants; the survey of the museum standards gives its vocabulary.
4. **A standard export, later.** Because the hub's records follow the event shape (survey 1), an export in a museum exchange format stays possible. Not needed now; do not block it.
5. **The archive must be run, copied and checked** — a dated habit in the runbook: run, copy off-site, open `index.html` from the copy.
6. **Outside the hub, for Pem and a lawyer:** who has authority over the works, the rights and the accounts; the will naming them. Not a build.

**Pem's answers (2026-11-21):**
- Images: AVIF is accepted — « I wouldn't worry about that right now ». Gap 1 is closed as an accepted choice.
- Audio: checked in the script the same day — it copies every file of the storage bucket it lists (except `recycle/`, `share-inbox/`, `ledger/`) and writes the `voice_note` table (transcripts) to `data/json/`. Whether the audio files live in that bucket (the table has its own `bucket` column) is **not verified**: one run of the archive and a look for an audio file settles it.
- The stranger's guide: an admin guide and a team-member guide exist (`docs/archive/ADMIN_GUIDE.md`, `TEAM_MEMBER_GUIDE.md`, and the in-app Aide). They explain how to **use** the app; the introduction package explains how to **read the records without it**. They are the source to extract from, not the package itself. Not read here.

## 4. What to take

- The archive's shape is right and matches the guides: inventory + images + papers + plain formats + a read-me.
- Three things to settle before the pause: image format in the archive, audio in the archive, the stranger's guide.
- One habit for the runbook: run, copy, check.

## Sources

- Joan Mitchell Foundation, CALL — https://joanmitchellfoundation.org/uploads/pdf/CALL-EPW-II-2018-Download.pdf · https://joanmitchellfoundation.org/blog/the-artists-archive-case-study · https://www.joanmitchellfoundation.org/uploads/pdf/CALL-Workbook-Dec2013.pdf
- Estate planning for artists — https://nysba.org/estate-planning-for-artists-how-to-plan-and-protect-your-legacy/
- Library of Congress, Recommended Formats Statement — https://loc.gov/preservation/resources/rfs/ (index only; format tables not read)
