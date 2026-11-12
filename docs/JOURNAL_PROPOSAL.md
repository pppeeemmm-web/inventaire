# Journal — phase 2 proposal (nothing built)

_Brief `BRIEF_CLAUDE_CODE_audit_journal.md`, phase 2. Read from live data and code 2026-11-12; owner answers 2026-11-12 folded in. Building any part needs a GO per item. Rules map: [`ARCHITECTURE.md`](./ARCHITECTURE.md)._

## Where we start (live, 2026-11-12)

- `work_session`: 55 rows over 44 days; the journal already merges several sessions of one date into one day. Items carry title, size, technique, support, notes, photos.
- `voice_note`: 9 rows; audio in R2 (`audio_r2_key`) + one editable `transcript` (browser dictation — an edit overwrites).
- `sketchbook`: table exists, 0 rows. `concept`: 4 rows. `tblrelations` link types: buyer, influence, located_at, owner, proximity, series, theme, workgroup.
- Index: `nodes` + one local embedding model for everything (`nomic-embed-text` via Ollama). Not indexed: kaizen, voice notes, documents, image notes.
- This PC: RTX 4070 Laptop (8 GB), 64 GB RAM, i9-14900HX, Ollama. Installed 2026-11-12 for this: Python 3.12, FFmpeg, faster-whisper, `qwen2.5vl:7b` (see [`AUDIT_2026-11.md`](./AUDIT_2026-11.md) for the install record).
- Manifold Atlas: reference copy = `Desktop/manifold_atlas_2.md` (16 Jul, owner 2026-11-12).

## Owner decisions (2026-11-12)

| Question | Answer |
|---|---|
| Default visibility of an entry | **All team members.** An admin can make one private. |
| Painted over (full cover) | **A new entry with a link** ("painted on") — no fate, no status change on the covered work. |
| Atlas reference | The latest (`manifold_atlas_2.md`). |
| Sketchbook | **Kept** — for photographed pages or drawings straight from an app (phone or desktop). Not folded away. |
| Kaizen | Audit moved to the top of the Kaizen group (done 2026-11-12). Kaizen = app, business and system improvement. |
| Local transcription tools | Yes — installed. Handwriting test on ~10 pages: reminder on 2026-11-13 (Overview). |

## Proposal

| Brief point | Proposal |
|---|---|
| **The day is the unit** | No "day" table: everything carries its date; the day page gathers entries, captures, field changes (`oeuvre_versions`), photos, voice notes and sketchbook pages of that date. `work_session` stays the photo-capture tool, attached to its day. |
| **Entries** | One table `journal_entry`: kind (spark / trigger / reflection / note / voice / handwriting / atlas), Pem's text verbatim, entered-at + event date (may be partial), provenance (typed / voice / photo / import / AI), verification status, visibility (default team), author. |
| **Append only, no deletion** | Text never edited: a correction is a new entry pointing to the old one. No physical delete (hide only). Enforced by DB triggers. |
| **Field changes in the feed** | Read from `oeuvre_versions` (field names fixed 2026-11-12) — never copied. |
| **Everything on the phone** | The phone uses the same work drawer and the same `saveWork` path for a new work or a new version — same data whatever the device. **Requirement (owner): usable on iPhone SE (375 × 667) and at least as fast as today's session form** — a field mode with the capture fields first (photo, title, size, technique, support, note) and the rest folded below; no more taps than today; verified at 375 × 667 before it replaces the form. |
| **Work or version** | Partial rework (glaze, scumble, pentimento) = version: new photo + version row on the same number. Full cover = new work, new number, entry + "painted on" link (owner). New support = new work, "derived from" link. |
| **Spark** | Entry of kind spark — dated, append-only, linked to a work, a concept, or nothing. |
| **Sketchbook** | Kept as its own source (photos or app drawings), shown in the day; its pages can be linked from entries. |
| **Manifold Atlas** | Option B: each section → an `atlas` entry imported verbatim (provenance import); ideas bank → sparks; appendices A/B verbatim. |
| **Kaizen / concepts** | Kaizen keeps improvement entries (app, business, system; Audit at the top). The 22 Création entries and 8 voice ideas move to the journal keeping author and date. A concept = durable node promoted from recurring entries. |
| **Constellation** | Each entry → a node (same embedding model). AI-suggested links stored as proposals, marked AI; only Pem's validation writes `tblrelations`. |
| **Voice** | Audio = reference. Transcripts stored as added versions (engine, date, unverified), never overwriting. Batch run triggered by Pem: faster-whisper on the RTX 4070. |
| **Handwriting** | Photo = reference. Batch transcription with `qwen2.5vl:7b` through Ollama, added as unverified text. Test ~10 pages first (reminder 2026-11-13). |
| **AI content** | Always shown with a visible AI symbol. |

## Indexing order (brief)

1. Journal entries at creation · 2. `voice_note` transcripts and image notes · 3. text documents · 4. Kaizen only for entries moved to the journal. Stock, suivi, condition reports: no semantic index. One embedding model.

## Invariants

Add only (no overwrite) · no physical deletion · two dates (entered / event) · provenance + verification on every entry · Pem's text kept as written · one datum in one place · journal changes to a work go through `saveWork` and the rules in `ARCHITECTURE.md` (no second notion of fate).

## Build order (each step needs a GO)

1. `journal_entry` table + append-only triggers + day page reading existing sources.
2. Phone field mode of the work drawer (iPhone SE check, timed against today's form).
3. Atlas import (option B) and Kaizen Création / voice ideas migration.
4. Transcription batches (voice, handwriting) with added versions + AI marks.
5. Entry nodes + AI link proposals in Constellation.
