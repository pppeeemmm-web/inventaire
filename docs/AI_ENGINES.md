# Moteurs d'IA dans PEM Hub / AI engines in PEM Hub

**Status: read from the code and `.env.local` on 2026-11-18** (Pem asked « which AI engines are doing anything on the websites, on the system »). The production environment variables on Vercel were **not** visible: where a feature depends on a key set there, it says so.

## In one line

The **public website** (`/`, `/works`, `/about`, `/practice`, `/enquiry`, the collector kit `/c/…`) uses **no AI at all**. In the **Atelier**, AI is optional everywhere: when an engine is not set up or cannot be reached, the feature does less, nothing breaks.

## Engine by engine

| What it does | Engine | Where it runs | On the live site |
|---|---|---|---|
| Meaning-based search (⌘K) and the Journal's ✦ suggestions | **Ollama**, model `nomic-embed-text` — turns text into vectors | **Pem's PC** (`127.0.0.1`), through `npm run embed:worker`; the vectors are stored in Supabase (`nodes.embedding`, pgvector) | The stored vectors are used. A brand-new search phrase is turned into a vector only when Ollama can be reached; on Vercel, search falls back to plain text. |
| Contact from a web address (name, role, city read from the page) | **Ollama** `llama3.2:1b` on Pem's PC, or **OpenAI** when a key is set | Pem's PC / OpenAI's servers | Only if Vercel has an `OPENAI_API_KEY` (none in `.env.local`). |
| Business card — the optional « AI » pass after the text is read | **OpenAI**, model `gpt-4o-mini` unless `OPENAI_VISION_MODEL` says otherwise | OpenAI's servers | Same: only with the key on Vercel. |
| Business card — reading the text | **Apple Live Text** on the iPhone | On the phone itself | Yes. Nothing is sent anywhere for this step. |
| Voice notes — transcripts of recorded notes | **faster-whisper** large-v3 (Whisper) | **Pem's PC**, batch `scripts/transcribe/voice_batch.py` (venv) | Only once the batch has run on the PC; the Overview « Local jobs » card counts what waits |
| Image descriptions (search by what a picture shows) | **Ollama** `gemma3:4b` | **Pem's PC**, `scripts/describe-run.ps1` (task « PEM describe batch ») | The stored descriptions are used; new ones only after the batch runs |
| Voice notes — live dictation | The browser's own speech recognition (Safari → Apple, Chrome → Google) | The browser / phone service | Yes, on the phone. The app calls no transcription service itself. |
| Social captions for Diffusion | **OpenAI or Anthropic**, connected inside **Make.com** | Make.com, outside this repo ([`BROADCAST_OUTSIDE_CHAIN.md`](./BROADCAST_OUTSIDE_CHAIN.md)) | Only while the Make scenario runs. The app gives Make the title, technique, sizes and Pem's caption seed; Make writes the caption. |

## Not AI (looks like it, isn't)

- **Colour families** of a picture (Inventory → Couleurs): computed pixel by pixel ([`lib/image-palette.ts`](../lib/image-palette.ts)).
- **« Revoir »** picks: a seeded random draw per day.
- **Vercel Analytics**: page-view counts.

## What leaves Pem's machines

- To **OpenAI**: a business-card photo, or a web page's text, only if `OPENAI_API_KEY` is set on Vercel.
- To **Make.com** (and its AI): work titles, techniques, sizes and caption seeds of works marked « Prêt pour diffusion ».
- Everything Ollama and Whisper do stays on Pem's PC.

_Corrected 2026-11-18 (same evening): the first version missed the Whisper transcripts and the gemma3 image descriptions. AI desk: [`design/2026-11-18/AiDesk.notes.md`](./design/2026-11-18/AiDesk.notes.md)._

**Local only (Pem 2026-11-18).** No OpenAI: the **Bureau IA** screen (`/atelier/ai`, admin) queues work in `ai_job`; the PC agent (`npm run ai:agent`, started at sign-in by `scripts/register-ai-agent.ps1`) runs it on the PC's models, one job at a time, and checks in to `ai_agent` every minute. Phase 3 (business cards read by a local vision model, suggested on the desk) is next.

## How to check the one unknown

Bureau IA → « Clé OpenAI sur ce serveur » (oui / non) on the live site. Local only means it should read « non »: if « oui », delete `OPENAI_API_KEY` in Vercel → the project → Settings → Environment Variables (Production).

## Where it lives in the code

- Card AI: [`lib/contact-card-vision.ts`](../lib/contact-card-vision.ts), [`app/atelier/capture/card-actions.ts`](../app/atelier/capture/card-actions.ts)
- Web-address reading: [`lib/contact-url-enrich.ts`](../lib/contact-url-enrich.ts)
- Embeddings: [`lib/graph/embedding-config.ts`](../lib/graph/embedding-config.ts), [`app/atelier/search/actions.ts`](../app/atelier/search/actions.ts), [`scripts/embed-worker/`](../scripts/embed-worker/)
- Dictation: [`lib/voice/web-speech.ts`](../lib/voice/web-speech.ts)
