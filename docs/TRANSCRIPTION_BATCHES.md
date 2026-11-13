# Transcription batches — owner instructions

Journal build step 4 ([`JOURNAL_PROPOSAL.md`](./archive/JOURNAL_PROPOSAL.md)). Written 2026-11-12; scripts added 2026-11-13 (owner GO "write the scripts").

## Scripts (written 2026-11-13, `scripts/transcribe/`)

Run from the repo folder with the venv's Python: `C:\Users\pppee\.venvs\transcribe\Scripts\python.exe`.

| Script | Does | Writes |
|---|---|---|
| `voice_batch.py` | Lists voice notes that have audio. `--run` transcribes them (faster-whisper, GPU). `--run --write` adds each transcript as a journal entry (kind voice, unverified, engine named). | Without `--write`: local JSON only, in `C:\Users\pppee\.venvs\transcribe-out\voice`. `--write` is refused until [`journal_entry_source.sql`](../supabase/sql/journal_entry_source.sql) is applied. |
| `fetch_whisper_model.py large-v3` | Downloads the transcription model once (~3.1 GB, curl, resumes). | `C:\Users\pppee\.venvs\models\` |
| `handwriting_test.py "<folder>"` | Runs `qwen2.5vl:7b` on up to 10 page photos; makes `report.html` (photo · transcript). | Local files only — never the database. |

Test-run 2026-11-13: list mode (1 of 9 voice notes has audio, 184 s — the other 8 are dictation text only); `--run --model tiny` (160 s of audio in 4 s, French detected, local file); handwriting pipeline on a generated page (11 of 11 words, 39 s including model load). Not run: large-v3 (model not downloaded), `--write`, real handwriting.

**From the app (2026-11-13):** Overview (admin) → **Local jobs** card → "Run on this PC" opens `pem-embed:run` → `scripts/embed-run.ps1`: `voice_batch.py --run --write` (notes already done by the same engine are skipped), then `npm run embed:worker -- --drain` — one after the other, never in parallel (8 GB GPU). The card counts voice notes with audio and no transcript, and nodes waiting for indexing; on a phone it only shows the counts. Transcript text is cleaned of the replacement character and control characters (newline kept) before insert. Journal day page: a transcript entry shows its audio player and "✦ transcript · engine · unverified"; an admin can mark it verified (or back).

Timing, GPU otherwise idle (2026-11-13): large-v3, 160 s of French audio in 36 s, model load 4 s (about 4.4× real time). Under contention with the vision model it took 416 s — run jobs one at a time.

**Image descriptions, round 2 (2026-11-13, nothing written to the database):** `describe_images_test.py --same <round-1 result.json>` — same 20 works, two prompts (`labelled`: figures / objects / setting / light / marks / unusual lines; `inventory`: one thing per line, largest first, then `marks:`), generic words banned, catalogue facts (title, technique, support, size, year) given. Two models, one after the other: `qwen2.5vl:7b` and `gemma3:4b` (pulled 2026-11-13, 3.3 GB, owner OK). Images converted with sharp (`to_jpeg.mjs`) — ffmpeg could not read 5 grid AVIFs in round 1; the round-1 timeout was GPU contention. Result: 0 errors; seconds per image with the GPU otherwise idle — qwen labelled 3.8, qwen inventory 1.3, gemma labelled 1.5, gemma inventory 1.8 (first image of each model adds the load: 7.8 s / 25.7 s); banned words left: qwen 15 + 3, gemma 0. Seen: gemma sometimes copies the prompt's example ("a dark oval, maybe a head"). Report: `C:\Users\pppee\.venvs\transcribe-out\describe\20261113-122516\report.html`. Owner judges before any batch; a batch would store descriptions apart (AI, unverified), never in `Commentaires`. **Owner reading (2026-11-13):** prefers `gemma3:4b` — "quite factual and useful"; from round 1 he valued the inspirations and style comparisons (e.g. El Greco), which the round-2 prompts ban. Next: owner GO for a batch with Gemma, and whether to add a separate "echoes" line (artists / styles recalled, marked AI).

Not built: the handwriting full batch (C) is not written — it depends on the test result.

## What is already in place

- On this PC (RTX 4070 laptop): Python 3.12, FFmpeg, the `transcribe` venv with faster-whisper, and `qwen2.5vl:7b` in Ollama. A GPU test passed on 2026-11-12 ([`AUDIT_2026-11.md`](./archive/AUDIT_2026-11.md)).
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
