# Journal on the desk — paste, drop, 🎤, photos from the PC (draft for Pem, 2026-11-23)

Status: **local draft**, not committed, nothing built, no SQL. Side session for the lead. Mockup beside this file: [`JournalDesk_Mockup.html`](./JournalDesk_Mockup.html) (desk, 1280 px, clickable).

Read before writing: root `CLAUDE.md`; [`BuildingPrinciples.md`](../2026-11-21/BuildingPrinciples.md) (§2, principles 9–13); [`JournalDesign.md`](../2026-11-22/JournalDesign.md) (approved); [`Survey_JournalCapture.md`](../2026-11-21/Survey_JournalCapture.md); [`IdeasDesign.md`](./IdeasDesign.md) §1. Live code read 2026-11-23: `app/atelier/capture/inspiration-actions.ts`, `app/atelier/(portal)/notes/actions.ts` (`createVoiceNote`), `lib/mobile/capture-queue.ts`, `components/journal/JournalDesk.tsx`, `components/shared/VoiceNoteSheet.tsx` (where it is used), `lib/voice/*`, `lib/image-upload.ts`, `scripts/ai-agent/*`, `scripts/register-ai-agent.ps1`, `supabase/sql/inspiration_photo.sql`, `ai_job.sql`, `journal_scale.sql`, the generated types. On this PC (read only): the Syncthing config (folder paths and device names only) and the shape of the synced folder (names, counts, sizes — no picture opened). Not done: nothing tried in a browser; no database read.

---

## 0. In one paragraph

The desk Journal already is the stream of days. Three ways in are added, **all landing on a day's page through doors that exist**: (1) **paste or drop an image** on any day — it becomes that day's inspiration photo, and a small text field opens under it where `#` and `@` link; (2) **🎤 on the desk** opens the same recorder the phone uses, with the laptop microphone; the note lands on today like the phone's; (3) **« Sur ce PC »**: the photos the iPhone sends to the PC by Syncthing show as a quiet tray **on the day they were taken**; Pem ticks the ones worth keeping and only those go up. The PC agent (the one Bureau IA starts) does one new local step: it reads the synced folder, turns HEIC into JPEG and makes small previews **on the PC**; it sends nothing to the database or to R2. No new table, no new door, no new screen.

## 1. Kind, home, what changes (principles §2)

| Question | Answer |
|---|---|
| Kind | A moment of the day: an image (inspiration) with its words, or a voice note. Same kinds as the phone's captures. |
| Home | The day's page (`inspiration_photo`, `voice_note` + its `journal_entry`). No inbox: the PC tray is not a store — it is a **view of a folder on the PC**, nothing in it exists in the hub until Pem picks it (principle 9: the capture lands on the day's page). |
| What changes | The desk frame gains a drop target per day, paste, a 🎤 button, and the « Sur ce PC » tray. `addInspirationPhoto` gains an explicit day and two honest answers (§3). The PC agent gains one local step. |
| New table, store, door or screen? | **None.** The tray's memory (« already sent », « not for the Journal ») is kept on the PC, not in the database — it describes Pem's PC, not the work. |

## 2. Look before building (principle 11) — what was found

| Where | Found | Consequence |
|---|---|---|
| The system | The phone capture is all there: `addInspirationPhoto` (admin, one-time id = record id, so a resend writes nothing twice), `setInspirationCaption`, `createVoiceNote` (writes the `journal_entry` at once), `VoiceNoteSheet` (MediaRecorder + live words), the offline queue `lib/mobile/capture-queue.ts` (IndexedDB, nothing phone-specific in it). `VoiceNoteSheet` already runs on desk screens (old day view, Idée desk). | The desk reuses all of it. |
| The system | The new desk stream (`JournalDesk.tsx`) has a composer for a line (`createJournalEntry`), no 🎤, no image. | The three ways in are added to this frame only. |
| The system | **Sharp on this PC and on the server cannot decode HEIC** (tried on one synced photo: metadata reads, decoding fails « compression format has not been built in »). `validateWorkImageBuffer` accepts HEIC, then the AVIF step fails and the door answers `r2_failed` — a wrong answer (principle 3). The phone is not hit: Safari sends a JPEG. | The door refuses HEIC by name (`heic`); HEIC is converted **on the PC** before it is sent. |
| The device | **Windows on this PC decodes HEIC** (WIC opened the same photo, 3024 × 4032); ImageMagick and ffmpeg are installed. Chrome cannot show HEIC. | The agent converts with WIC (no new install). **Build 2026-11-23:** Windows' decoder fails on some iPhone HEIC (codec error 0xC00D5212); **ImageMagick reads all 201**, turns them upright and gives the photo's data → the agent uses ImageMagick for every format. |
| The device | Syncthing is installed and running: one folder « Sync all » on the Desktop, shared between « iPhone » (app **Synctrain**, Think Train — Pem 2026-11-23) and the PC. Inside: **one folder per day** (`2026-05-28` … `2026-11-22`, 80 days), 330 files, 703 MB — 201 HEIC, 108 AVIF (`APC_…-hdr.avif`), 16 JPG, 4 PNG; largest 5.6 MB; no video today. | The day is in the folder name. Sizes fit the door (12 MB). |
| The device | Sharp drops a photo's metadata unless asked (`normalizeImageToAvifPair` does not ask). | GPS and camera data in the iPhone file never reach the stored copy. |
| The field | Chrome can read a folder the user picked once (File System Access API) and, from Chrome 122, keep that permission (« Autoriser à chaque visite »). Chrome's live dictation (Web Speech) **sends the sound to Google**; Safari on iPhone uses Apple's. `docs/AI_ENGINES.md`: « Nothing is sent to any other AI service » — for the PC models. | §5 A4: on the desk, no live words by default; the PC transcribes right after. |
| The field | Desktop Chrome keeps recording when the tab is behind another window (the iPhone stops). | No « keep the screen open » warning on the desk. |

## 3. Doors — reused, changed, new

| Door | Use on the desk | Change |
|---|---|---|
| `addInspirationPhoto` | paste, drop, tray pick | **(a)** an explicit `day` (admin; any past day, never ahead of today in Paris) — today it lands on today, or on `taken_at` within 14 days for a queued capture. Needed for a drop on a past day and for the tray. **(b)** HEIC refused by name (`heic`), not `r2_failed`. **(c)** a resend answers `{ ok, id, day, already: true }` so the desk can say « déjà dans le Journal, le 12 nov. » instead of a silent « ok » on another day (principle 3). **(d)** later, with its SQL: a `meta` field (the photo's own data, §6). |
| `setInspirationCaption` | the text under a dropped photo | none |
| `createVoiceNote` | 🎤 on the desk | none (same FormData as the phone; `audio/webm` is allowed) |
| `createJournalEntry` | the composer (exists) | none |
| `lib/mobile/capture-queue.ts` | a paste, drop or recording with no network waits on the PC like on the phone | none (moved under `lib/capture/` when touched — it is not phone-only) |
| `pem-ai:` link → `start-hidden.vbs` → `scripts/ai-agent/index.mjs` | « Préparer » in the tray starts one pass; one pass at Windows sign-in (exists) | the agent runs the tray step at **every pass**, after the jobs and the check-in, so a voice note never waits for photos (§6). No new `ai_job` kind (the kind check is SQL); it writes no table. |
| One-time id for a tray photo | — | the id is made from the **original file's SHA-256** (a UUID from the hash): the same photo picked twice, or present in two folders, is one record — the existing door already returns the saved one. |

**`#` and `@` under a photo — what depends on what.** Principle 13 asks for real links. Today `inspiration_photo` can hold one work and one idea (`oeuvre_id`, `concept_id`), and the shared `#` / `@` picker is not built. The real links come with Journal Step B (« a photo writes a `journal_entry` at once ») and Step B part 2 (`@` person links, TODO) — both SQL with their own OK. **Until then:** the text is saved as typed; the first `#` work and the first `#` idea fill the two existing columns; `@` stays text, shown in grey « lien à venir ». When Step B lands, the same field writes the links in `journal_entry_link`; nothing on the desk is redrawn.

## 4. The three scenarios — steps Pem can check

**A. Paste or drop an image (desk, Chrome, 1280 px).**

1. On another site, right-click an image › « Copier l'image ». Open the Journal, scroll to 18 November. Press Ctrl+V anywhere in the stream (not in a text field): the image lands at the end of **the day on screen** — the day whose divider is pinned at the top (Pem 2026-11-23) — a thin bar shows it sending, then the card « Photo · ajouté le 23 nov. » with the picture. A toast names the day (« Collée sur mar. 18 nov. ») so a paste on the wrong day is seen at once.
2. Under the picture a field is already open: « Qu'est-ce que c'est ? ». Type « lumière de fin d'après-midi sur #Coquill » — the work « Coquillages » is offered with its picture; Enter. The card shows the text with the work as a chip.
3. Drag a JPG from the Explorer over the stream: the day under the pointer lights up « Déposer sur ven. 14 nov. ». Drop on 14 November: the card lands at the end of that day and says « ajouté le 23 nov. ».
4. Drop the same file again on any day: nothing new; a note « Déjà dans le Journal, le 14 nov. » with a link to it.
5. Drop an iPhone HEIC: refused before sending, « HEIC : mets-la dans le dossier Sync, le PC la convertit » (§5 A2).
6. Pull the network cable, paste: the card shows « en attente d'envoi »; plug back: it sends, once.

**B. A voice note with the laptop microphone.**

1. Click 🎤 in the top bar (or under today's composer). The first time, Chrome asks for the microphone: « Autoriser ».
2. The recorder sheet opens (the phone's, in a side panel): the timer runs, the level moves. No live words (A4). Speak, click « Arrêter ».
3. A card lands at the end of today: « Note vocale · 15:32 », the audio, « transcription en attente », and the button « Transcrire sur ce PC ».
4. Click it: the agent starts (same as Bureau IA « Lancer sur ce PC »); after about a minute the card shows the words and « Vérifier · corriger ».
5. A note made on the wrong day: « ⋯ › Placer sur un autre jour » (Journal Step B) — same as the phone.

**C. Photos from the iPhone via Syncthing.**

1. Take three photos on the iPhone in the morning. Syncthing copies them to « Sync all\2026-11-23 » on the PC (as today).
2. Sign in on the PC (or click « Préparer » in the tray): the agent pass makes the previews, about 0.5 s per photo (ImageMagick).
3. In the Journal, today's divider shows a quiet chip « 📁 3 sur ce PC ». Older days with untouched photos show theirs too.
4. Click the chip: a strip opens under the divider with the three previews, each with a tick. Tick two, click « Mettre sur ce jour (2) ». Two photo cards appear on 23 November, each with its text field open; the third preview stays in the strip.
5. On the third: « Pas pour le Journal ». It leaves the strip and the chip; it stays on the PC and on the phone, untouched.
6. Top bar « 📁 Sur ce PC · 41 »: the whole tray, by day, newest first; « Tout masquer avant le… » clears old days in one click (only on this PC).
7. Pick a photo already sent: « Déjà dans le Journal » (same id from the same file).

## 5. Desk limits — assumptions (to check on the first prototype, Chrome on the PC)

| # | Limit | Assumption / rule |
|---|---|---|
| A1 | Microphone | Chrome asks once per site and keeps it. Windows › Confidentialité › Microphone must allow apps (and desktop apps). A refusal shows the existing `mic-permission` help, with the Chrome path instead of Safari's. |
| A2 | Clipboard and drop types | Paste gives PNG (a copied image) or the file; drop gives the file. Accepted: JPG, PNG, WebP, GIF, AVIF (the door's list). **HEIC refused in the browser** — Chrome cannot show it and the server cannot read it; HEIC comes through the PC tray. A link dragged from another site (no file) → « Glisse le fichier, ou copie l'image ». |
| A3 | Size | The door takes up to 12 MB and stores 2100 px. Above 12 MB (a big PNG screenshot) the browser first scales it to 2100 px JPEG — the stored result is the same. Audio: 20 MB (about 20 min of webm). |
| A4 | Live words | Off on the desk: Chrome's dictation sends the sound to Google. The PC (Whisper) transcribes right after, on « Transcrire sur ce PC », or at the next pass. (Question 3.) |
| A5 | Drop on a past day | Any past day of the Jours view, or a day line of the Mois view; never a future day, never an Années line (a month has no day). The card says « ajouté le … » so the day it was added stays visible (Delacroix lesson 2). |
| A6 | Order inside a day | A dropped photo goes at the end of the day it is dropped on, at the time it was added (« as written » — the order is never changed). |
| A7 | Offline | Paste, drop and recording queue on the PC (IndexedDB, same queue as the phone) and send once when the network returns. The tray needs no network to show; « Mettre sur ce jour » queues too. |
| A8 | Who | Admin only, like the phone (RLS: admin insert). A team member sees no drop target, no 🎤 on the stream, no tray. |
| A9 | Browser | Chrome (Pem's). Edge behaves the same. Firefox has no folder access: the tray says « Ouvre le Journal dans Chrome ». |

## 6. The Syncthing pickup

**Where.** `%USERPROFILE%\Desktop\Sync all` — Syncthing folder « Sync all », shared with « iPhone ». Day folders `YYYY-MM-DD` made by the phone app. The path is a setting of the agent (`.env.local`: `JOURNAL_SYNC_DIR`), not in the code.

**What the agent reads.** Only that folder, read only. Image files (`.heic .jpg .jpeg .png .webp`). **AVIF files are skipped**: they are Pem's Lightroom mobile edits of works (`APC_…-hdr.avif`), already in the catalogue as new versions of works (Pem 2026-11-23) — work photos keep that path, the tray is for inspiration only. HEIC stays the iPhone's format (Pem keeps it for raw edits), so the conversion on the PC is permanent, not a stopgap. Also ignoring `.stfolder`, `.stversions`, hidden and partial files (`~syncthing~*.tmp`). A file still growing (modified in the last 60 s) waits for the next pass.

**What it writes — only on the PC, outside the synced folder.** `%USERPROFILE%\PEM-Tray\` (not synced by Syncthing; to check that OneDrive does not sync it):

- `previews/<hash16>.jpg` — 480 px, for the tray;
- `send/<hash16>.jpg` — every photo: upright 2100 px JPEG, metadata stripped, made by ImageMagick — what the browser sends (the photo's data is kept in `tray.json`, `meta`);
- `tray.json` — one line per photo: file path, day, SHA-256, size, width × height, preview name.

The agent **never writes, moves, renames or deletes** anything in « Sync all »: a change there would travel back to the iPhone.

**Which day.** The folder name (the phone's day). Else the photo's own date (EXIF « DateTimeOriginal »), in Paris time. Else the file's date. The tray shows which it used when it is not the folder (« date du fichier »).

**Dedupe.** The record's id is made from the SHA-256 of the original file: picked twice, copied in two day folders, re-synced after a phone restore — one record. What it cannot catch: the same photo sent earlier from the phone (Safari re-encodes it, so the bytes differ). That shows as a second photo; « ⋯ › Supprimer » removes it.

**What the tray remembers (on the PC, in Chrome's IndexedDB):** the ids sent and the ids marked « Pas pour le Journal ». Lost if Chrome's site data is cleared: then already-sent photos reappear, and a resend is refused by the door as « déjà dans le Journal » — no double.

**What is never uploaded.** A photo not picked: not the photo, not a preview, not its name, not the list, not the count. The agent sends nothing anywhere.

**The photo's own data (Pem 2026-11-23: « don't forget their metadata »).** The stored image is re-encoded (AVIF 2100 px) and Sharp drops what was inside the file. So the data is read **before** that and kept beside the photo as plain fields, readable and searchable: date and time taken, camera / phone, lens, exposure (aperture, speed, ISO), size in pixels, original file name — and **the place (GPS), kept** (Pem 2026-11-23 « why not? »). The place is read by admin only: `inspiration_photo` is readable by the team (RLS team select), so the GPS goes in the admin-only part of the design (to settle in the SQL: a column the team's read does not return, or a separate admin-only row) — never on the public site, never in the archive export without Pem's say. Who reads it: the agent from the HEIC / JPG in the tray (it already opens the file); the browser for a pasted or dropped JPG (EXIF read in the page; a copied image from another site has none). Where it lives: `inspiration_photo` has no column for it → one `meta` column (jsonb) — **SQL, its own OK**, small, with the Step B batch. Until then the card shows the time taken in its meta line and the data is not stored. The card shows « prise le 14 nov. à 10:12 · iPhone SE » when it differs from the day it is on. The original file stays on the phone and the PC, untouched.

**Where `PEM-Tray` is.** It does not exist yet: the agent creates it on its first pass, as `%USERPROFILE%\Desktop\PEM-Tray`, next to « Sync all » (moved there 2026-11-23: the folder picker opens on the Desktop). Checked 2026-11-23: OneDrive does not back up the Desktop, Documents or Pictures on this PC, and the user folder is not synced by Syncthing — so the tray copies stay on this PC only. Pem never needs to open it; « Relier le dossier » picks it once.

**Old photos.** « Sync all » holds about 300 iPhone photos from 28 May to today. **The tray starts on the day the feature goes live** (Pem 2026-11-23: a dump of everything would have to be erased, « not the point of this journal »). Older photos are never shown as chips; « voir les plus anciens » at the bottom of the tray pane lists them by day for the rare look back.

**Undo (Pem: « a check-in if I make a mistake »).** Nothing in the tray is final: « Pas pour le Journal » moves a photo to « Écartées » at the bottom of the tray pane, where « Remettre » brings it back (this list lives on the PC, like the rest of the tray). A photo put on the wrong day: « ⋯ › Placer sur un autre jour » (Journal Step B); put by mistake: « ⋯ › Supprimer » (exists, admin, with a confirm) — the original stays on the phone and the PC, so it can be picked again.

**How the page reads the tray.** The first time, « Relier le dossier » in the tray opens Chrome's folder picker on `PEM-Tray`; Chrome then keeps the access (« Autoriser à chaque visite »). Considered and set aside: a small server run by the agent on `localhost` (always on, and Chrome's private-network rules), and the agent uploading previews for a tray in the database (private photos leave the PC before Pem chose).

**When it runs.** At every agent pass: at Windows sign-in (exists) and on « Préparer » in the tray (`pem-ai:` link, exists). At the end of the pass, after the jobs (a voice note never waits for photos). Measured 2026-11-23: first pass over the 221 iPhone photos 1 min 42 s, 0 failures; the next pass, nothing new, under a second.

## 7. Flow trace

**Inputs → writers.** Paste / drop / tray pick → `addInspirationPhoto` (+ `setInspirationCaption`) → R2 `inspiration/…`, `thumbs/inspiration/…` (+ storage ledger via `r2PutObject`) → `inspiration_photo`. 🎤 → `createVoiceNote` → R2 `voice-note/<id>/recording.webm` → `voice_note` + its `journal_entry` (kind `voice`). Later `voice_batch.py` (agent) → correction entry. Tray step (agent) → files on the PC only; no table.

**Triggers.** `inspiration_photo`: none (RLS admin insert / update). `voice_note`: `voice_note_touch` (updated_at). `journal_entry`: the append-only guard (unchanged).

| Reader | Changes? |
|---|---|
| Desk stream (`JournalDesk`, `JournalStream`, `lib/journal/stream.ts` → `lib/journal/day-read.ts`) | **yes** — drop target per day, paste, 🎤, tray chip on the divider, « ajouté le … » on a card added to a past day (reads `created_at` vs `day`) |
| Phone stream (`JournalPhone`, `/hub`, `TodayClient`, `CaptureQueue`) | no — same cards; a photo dropped on a past day shows there with the same « ajouté le » line (same card component) |
| Day counts `journal_scale` (photos by own `day`) | no — a past-day photo counts on that day, as wanted |
| Search (`app/atelier/search/actions.ts`, captions) | no |
| Archive export (`scripts/archive-export.mjs`) | no — it does not export inspiration photos at all (true before this change; a gap of its own) |
| Storage ledger (`scripts/storage-ledger-backfill.mjs`, `r2PutObject`) | no |
| Idée desk, work panel « Dans le Journal » | no (through the existing `concept_id` / `oeuvre_id` until Step B) |
| Bureau IA (`/atelier/ai`, `ai_agent` heartbeat) | no — the tray step adds lines to the job log only |
| Phone capture page (`CaptureInspirationClient`) | no — the door's new answers (`heic`, `already`) need their FR / EN messages there too |
| `voice_batch.py`, embed worker | no |

The usual failure here: a photo dropped on 14 Nov counts on 14 Nov (`journal_scale`, by `day`) but sorts by `created_at` inside the day — fine — while search or see-again use `created_at`. Checked: search lists captions without a day; see-again does not read `inspiration_photo`.

## 8. Build order (after GO)

1. Door change (a, b, c) + FR / EN messages; paste and drop on the desk stream; 🎤 via `VoiceNoteSheet` with live words off; the queue on the desk. Proof on the throwaway copy, then live. No SQL.
2. The agent's tray step (`scripts/ai-agent/tray.mjs`, ImageMagick) + the tray in the desk stream. Tried on this PC with the real folder (read only).
3. With Journal Step B (its own OK): the photo's text writes real `#` / `@` links.

Each step ends with screenshots at 1280 px set beside the mockup (Pem's fidelity rule, JournalDesign §9).

## 9. Pem's answers (2026-11-23, chat) — folded in above

1. iPhone app: **Synctrain** (Think Train).
2. `APC_…-hdr.avif`: Lightroom mobile edits of works, **already in the system** as new versions → skipped by the tray (§6).
3. Desk 🎤: no live words, the PC transcribes right after — **as proposed**.
4. iPhone keeps **HEIC** (raw edits) → the PC converts, permanently.
5. Paste: lands on **the day on screen**, not today (§4 A1). Keep the photos' **metadata** (§6).
6. Work photos in the tray: answered by 2 — works go through Lightroom, the tray is inspiration only.

7. Tray start: **the day it goes live**, with an undo for every step (§6).
8. Place (GPS): **kept**, admin only (§6).

Nothing open on the design side. Next: the lead's GO for build step 1 (no SQL), then the `meta` SQL with Step B.
