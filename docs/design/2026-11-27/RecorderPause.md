# Voice recorder: pause / resume, and Voice Memos recordings — short design

Status: **design for Pem to decide — nothing built.** TODO §1 « Voice recorder: a pause / resume button, and importing
a Voice Memos recording (records with the screen off) into the Journal as a transcribed note ». Pem in Madrid (Prado):
« Can I set up a recording session with a pause button for quick fire even if screen is off? »

## Which kind of thing, which home, what changes
- **Kind:** a voice note — the same thing as today (`voice_note` + its Journal entry, transcribed on the PC).
- **Home:** the Journal, through the existing voice note door. No new table, store or screen.
- **What changes:** the recording sheet gains « Pause / Reprendre »; the Journal gains « Importer un enregistrement ».

## What the phone allows (looked at before building — principle 11)
- Today's recorder is a web page (`lib/voice/web-speech.ts`, MediaRecorder at 32 kbit/s). **A web page cannot keep the
  microphone on with the screen off:** when the iPhone locks or the app goes to the background, the recording stops.
  No web setting changes that.
- A web page **can ask the screen to stay on** while it records (Screen Wake Lock, iPhone iOS 16.4+): the phone does
  not lock by itself mid-recording. Pem can still press the side button.
- MediaRecorder has pause / resume; to check once on Pem's iPhone (one tap test), as Safari's support has varied.
- **Voice Memos (Apple's app) records with the screen off** and has its own pause. Its files are .m4a; they can be
  shared to « Fichiers » and picked from a web page.
- One upload is capped at 4.2 MB (the server's limit per request): about **17 minutes** at today's 32 kbit/s; a Voice
  Memos file of that size is about **9 minutes** (its quality setting decides).

## Option A — « Pause / Reprendre » in our recorder (small)
- One button beside « Arrêter »: pause freezes the clock and the live words; resume continues **the same note** (one
  audio file, one Journal entry). The note's length counts only the recorded time.
- While recording, the screen is kept awake (wake lock), released on stop / pause / leaving the sheet.
- Files: `lib/voice/web-speech.ts` (pause / resume on the session), `components/shared/VoiceNoteSheet.tsx` (button,
  clock), copy FR + EN. No database change.

## Option B — « Importer un enregistrement » (Voice Memos and any audio file)
- Voice Memos → Partager → « Enregistrer dans Fichiers ». Then in the Journal (phone or desk): « Importer un
  enregistrement » → pick the file → it becomes a voice note **on the day it was recorded** (the file's date; today if
  unknown), transcribed by the PC like any voice note.
- Up to 4.2 MB per file (~9 min). Longer files would need a direct upload to storage — a bigger build, its own GO.
- Files: the voice note door (accept a picked .m4a / .mp3 / .wav, with its date), a picker in the Journal, copy.

## Recommendation
A now (small, covers « quick fire » with the phone in hand), B next. For a long gallery visit with the phone in the
pocket, Voice Memos + B is the only way that works with the screen off.

## Questions for Pem
1. A, B, or both?
2. Keep the screen awake while recording (A)?
3. How long are your typical memos — under 9 minutes, or longer (decides whether B needs the bigger upload)?
4. An imported memo lands on the day it was recorded (proposed) — or today?
