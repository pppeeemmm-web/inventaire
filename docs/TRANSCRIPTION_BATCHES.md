# Transcription batches — owner instructions

Journal build step 4 ([`JOURNAL_PROPOSAL.md`](./JOURNAL_PROPOSAL.md)). Written 2026-11-12; scripts added 2026-11-13 (owner GO "write the scripts").

## Scripts (written 2026-11-13, `scripts/transcribe/`)

Run from the repo folder with the venv's Python: `C:\Users\pppee\.venvs\transcribe\Scripts\python.exe`.

| Script | Does | Writes |
|---|---|---|
| `voice_batch.py` | Lists voice notes that have audio. `--run` transcribes them (faster-whisper, GPU). `--run --write` adds each transcript as a journal entry (kind voice, unverified, engine named). | Without `--write`: local JSON only, in `C:\Users\pppee\.venvs\transcribe-out\voice`. `--write` is refused until [`journal_entry_source.sql`](../supabase/sql/journal_entry_source.sql) is applied. |
| `fetch_whisper_model.py large-v3` | Downloads the transcription model once (~3.1 GB, curl, resumes). | `C:\Users\pppee\.venvs\models\` |
| `handwriting_test.py "<folder>"` | Runs `qwen2.5vl:7b` on up to 10 page photos; makes `report.html` (photo · transcript). | Local files only — never the database. |

Test-run 2026-11-13: list mode (1 of 9 voice notes has audio, 184 s — the other 8 are dictation text only); `--run --model tiny` (160 s of audio in 4 s, French detected, local file); handwriting pipeline on a generated page (11 of 11 words, 39 s including model load). Not run: large-v3 (model not downloaded), `--write`, real handwriting.

Not built: the journal day page does not yet show the audio player or the engine mark next to a transcript; the handwriting full batch (C) is not written — it depends on the test result.

## What is already in place

- On this PC (RTX 4070 laptop): Python 3.12, FFmpeg, the `transcribe` venv with faster-whisper, and `qwen2.5vl:7b` in Ollama. A GPU test passed on 2026-11-12 ([`AUDIT_2026-11.md`](./AUDIT_2026-11.md)).
- The database accepts journal entries of kind `voice` and `handwriting`, with provenance `voice` / `photo` and verification "unverified".
- The rules, unchanged: the audio or the photo stays the reference; a transcript is **added** text marked AI and unverified; it never overwrites anything; nothing is deleted.

## Before you start

1. **Leave the PC plugged in and awake.** The batches run on the PC's GPU, not on the website.
2. **Ollama running** (it starts with Windows; the tray icon shows it).
3. **Handwriting only:** put the page photos in one folder, one photo per page, upright, in reading order (file names sorted = page order). JPEG / HEIC / PNG are fine. For the first test, **10 pages**.
4. Know which day each set belongs to (the entry's event date). If unknown, say "date unknown" and they are filed with month or year precision.

## A. Voice notes (do this first)

1. Say: **"GO step 4 voice batch"**.
2. I write the script, then show you the list of voice notes that would be transcribed (today 9 `voice_note` rows), and how long it should take.
3. On your OK it runs: each audio is transcribed by faster-whisper and added to the journal as a `voice` entry on that day, marked AI + unverified, linked to its audio. The browser dictation text already on the note stays as it is.
4. **Check:** open the Journal on those days → 🎤 Notes vocales / entries. Read a few against the audio. Tell me what is wrong (names, art terms); I can add a word list for the next run.

## B. Handwriting — 10-page test first (reminder 2026-11-13)

1. Say: **"GO handwriting test"** and give me the folder path, e.g. `C:\Users\pppee\Pictures\carnet-2026-test`.
2. I run `qwen2.5vl:7b` on the 10 pages **without writing anything to the database** and give you a side-by-side: photo · transcript, with a rough error count per page.
3. You decide: good enough → batch; not good enough → I try a stronger setting or a different model, or we stop there.

## C. Handwriting — full batch (after a good test)

1. Say: **"GO handwriting batch"** with the folder(s) and the day(s).
2. Each page photo is stored like other images (AVIF, R2) and becomes a `handwriting` entry on its day: photo = reference, transcript = added text, AI + unverified.
3. **Check:** open those days in the Journal; correct a transcript by writing a correction entry (the original stays).

## After each batch

- New entries go through the usual chain: the embed worker indexes them, so they appear in ⌘K search, and ✦ suggestions are made with the 2026-11-12 rule.
- Each batch gets a What's new line and a docs update.
- Nothing is pushed to the website by a batch; only the data changes.

## If something goes wrong

- "CUDA / DLL not found": tell me; the script adds the venv's `nvidia/*/bin` folders to the DLL path, and I check that first.
- Model downloads failing: models are fetched with `curl` into `C:\Users\pppee\.venvs\models\` (Python downloads were reset by the host on 2026-11-12).
- A batch can be stopped at any time; entries already added stay and are marked unverified.
