# AI desk — draft (2026-11-18)

Pem, 2026-11-18: « I tried to improve [a business card] with the AI, and my phone couldn't connect to the AI because it's not on the phone. That's why I already said I need some dashboard for AI engines running … a central place for the desktop app so that I can improve, for instance, the data for the new contact. » **Draft for discussion — nothing built.** Design first: this note says what exists, the problem, one proposal and the decisions.

## What exists today

The AI that matters runs on **Pem's PC**, through batch scripts started by hand or by Windows tasks ([`AI_ENGINES.md`](../../AI_ENGINES.md)):

| Job | Engine (on the PC) | How it runs today | Backlog visible? |
|---|---|---|---|
| Search index (⌘K meaning search, Journal ✦) | Ollama `nomic-embed-text` | `npm run embed:worker`, `scripts/embed-run.ps1` | Yes — Overview « Local jobs » card (`countEmbeddingBacklog`) |
| Voice notes → text | faster-whisper large-v3 | `scripts/transcribe/voice_batch.py` (venv) | Yes — same card (`countVoiceTranscriptBacklog`) |
| Image descriptions | Ollama `gemma3:4b` | `scripts/describe-run.ps1` (task « PEM describe batch ») | No |
| Business card « Améliorer avec l'IA » | Photo: OpenAI only (key on Vercel?); text tidy-up: Ollama `llama3.2:1b` | In the capture screen, at capture time only. The call runs on the **server**: on the live site (Vercel) Ollama on the PC is out of reach **from any device**, so only an OpenAI key could make it work; Ollama works only when the app itself runs on the PC | No: nothing marks a card captured without the AI pass; the photo is kept in the Vault (`cards/K_…`) |
| Contact from a web address | Ollama `llama3.2:1b` / OpenAI | In the contact editor, at that moment only | No |

So: two backlogs are counted, three are invisible, the live site's server can never reach the PC's Ollama (hence a local agent, below), and every job is started from a terminal or a task — except the two that run inside a screen, which only work when that screen is on the PC.

## The problem, in one line

What is captured on the phone can't get its AI pass later, and nothing on the computer shows what is waiting or lets Pem run it.

## Proposal — one « Bureau IA » screen (computer, admin)

Grown from the Overview « Local jobs » card, under Kaizen (next to Audit).

1. **Engines** — one line each, green / grey: Ollama reachable on this PC + models present (`nomic-embed-text`, `llama3.2:1b`, `gemma3:4b`), Whisper installed, OpenAI key on the live site (yes / no). « On this PC » is only true in the browser on Pem's laptop; elsewhere the desk says « open this on the studio PC ».
2. **Waiting** — one row per queue with its count and its oldest item: search index, voice notes, image descriptions, **business cards captured without the AI pass**, contacts with a web address not yet read.
3. **Run** — a button per queue. A web page can't start programs on the PC, so the buttons hand the work to a small **local agent**: one process on the PC (`npm run ai:agent`, started with Windows) that picks jobs from a table and runs the existing scripts / Ollama calls. The agent replaces running the batch scripts by hand; it uses the same code.
4. **Results as suggestions** — an AI pass never overwrites a field. The desk lists « before → suggested » per item (like Audit → Validation); Pem accepts or rejects. A business card's suggestions fill the contact only on accept.

On the phone: nothing new to learn — a card captured there simply appears in « Waiting » on the desk.

## Data (sketch — SQL needs Pem's OK)

- New table `ai_job` (`id`, `kind` = embed / voice / describe / card / web, `target` (contact id, voice note id, work id), `status` = waiting / running / done / failed, `requested_by`, `result` jsonb (the suggestion), `error`, `created_at`, `done_at`). RLS: admin read / write; the agent writes with the service key from the PC's `.env.local`.
- Card captures mark themselves: `commitBusinessCardCapture` (`app/atelier/capture/card-actions.ts`) adds an `ai_job` row (kind card) when the AI pass did not run — the photo key and the Live Text go in the job.
- **Flow trace (to complete at build):** writers = capture screen (card job), desk (run / accept / reject), agent (status, result); readers = desk, Overview « Local jobs » card (counts), Contacts (accepted suggestion → contact fields, the normal save path), Aide (admin chapter « AI engines »).

## Phases

1. **Desk, read only** — engines + waiting counts + the exact command to run for each queue. Small; no SQL. Already removes « where is the AI, what is waiting ».
2. **Agent + `ai_job`** — the Run buttons; voice / embed / describe move onto it.
3. **Card and web suggestions** — accept / reject on the desk; the phone's captures flow there.

## Decisions for Pem

1. Phase 1 first (recommended), or straight to the agent?
2. Where: Kaizen (with Audit) or Overview (where « Local jobs » is today)?
3. Should OpenAI stay a fallback when the PC is off (data leaves the EU, see the legal note), or Ollama only?
4. Team members: see the desk (counts only) or admin only?
