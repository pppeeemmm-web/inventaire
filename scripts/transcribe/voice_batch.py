"""Voice notes -> transcripts (faster-whisper on this PC's GPU). Journal step 4 A.

  python scripts\\transcribe\\voice_batch.py                 list what would be transcribed (reads only)
  python scripts\\transcribe\\voice_batch.py --run           transcribe to local JSON files (no database write)
  python scripts\\transcribe\\voice_batch.py --run --write   also add each transcript as a journal entry

Rules (docs/TRANSCRIPTION_BATCHES.md): the audio stays the reference; a transcript is ADDED as a
journal entry (kind voice, provenance voice, unverified, engine named); the dictation text on the
note is never touched; a note already transcribed by the same engine is skipped.
An empty result (short clip: the voice filter cut everything) is retried once without the filter. Still
empty -> the phone's dictation text, when there is one, becomes the entry (engine « <engine> → dictée
téléphone »), so the note leaves the backlog instead of waiting forever (Pem 2026-11-18). No dictation
either -> an entry « (rien entendu) » (engine « <engine> → rien entendu », no AI link proposals): the
Journal shows it as « Rien entendu » with « Écrire ce qui a été dit », and the note stops being « to do »
(Pem 2026-11-22: one note stayed « 1 waiting » forever).
Since 2026-11-23 the phone writes the note's Journal entry at once (its live words, or « (transcription à
venir) »). The transcript is then ADDED as a correction of that entry (corrects_id; unverified, engine named;
the phone's words stay as its original). A note Pem already checked or corrected is never touched: a machine
never writes over a person. Nothing heard on a note that has phone words: the words stand; a correction with the same words (engine
« … → rien entendu (mots du téléphone gardés) ») marks the note done in the database.

--write needs supabase/sql/journal_entry_source.sql applied (voice_note_id / engine columns).
Options: --model large-v3 (folder under the models dir)  --words words.txt (names, art terms)
         --only <voice_note id>  --language fr|en (default: detected per note)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time

from common import MODELS_DIR, OUT_ROOT, Supabase, add_cuda_dll_dirs, download, load_env, paris_date, quote_key

SOURCE_COLUMNS = ["voice_note_id", "engine"]
# Must match lib/journal/nothing-heard.ts (the Journal draws such an entry as « Rien entendu »).
NOTHING_HEARD = "(rien entendu)"
NOTHING_HEARD_ENGINE = "rien entendu"
WAITING_TRANSCRIPT = "(transcription à venir)"  # must match lib/journal/nothing-heard.ts
# Replacement character + C0 controls except newline (owner 2026-11-13: "a few unusable characters").
_BAD_CHARS = re.compile("[�\x00-\x09\x0b-\x1f\x7f]")


def clean_text(text: str) -> str:
    return re.sub(r"[ ]{2,}", " ", _BAD_CHARS.sub(" ", text)).strip()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--run", action="store_true", help="transcribe (default: list only)")
    ap.add_argument("--write", action="store_true", help="add transcripts to the journal (needs --run)")
    ap.add_argument("--model", default="large-v3")
    ap.add_argument("--words", help="text file of names / terms to help spelling")
    ap.add_argument("--only", help="one voice_note id")
    ap.add_argument("--language", help="force fr / en (default: auto)")
    ap.add_argument("--device", choices=["cuda", "cpu"], default="cuda", help="cpu when the GPU is busy (slower)")
    args = ap.parse_args()

    env = load_env()
    sb = Supabase(env)
    engine = f"faster-whisper {args.model}"

    query = (
        "select=id,created_at,user_id,subject,transcript,audio_r2_key,audio_mime,duration_ms,oeuvre_id,concept_id"
        "&audio_r2_key=not.is.null&order=created_at.asc"
    )
    if args.only:
        query += f"&id=eq.{args.only}"
    notes = sb.select_all("voice_note", query)

    has_source = sb.has_columns("journal_entry", SOURCE_COLUMNS)
    done: set[str] = set()
    human_notes: set[str] = set()
    if has_source:
        # « like engine* » also counts the phone-dictation fallback written under this engine's name.
        rows = sb.select_all("journal_entry", f"select=voice_note_id&engine=like.{engine.replace(' ', '%20')}*&voice_note_id=not.is.null&order=id.asc")
        done = {r["voice_note_id"] for r in rows}
        # A person already checked or corrected the note's entry: never written over by a machine. The PC
        # still transcribes it, and keeps its text as a PROPOSAL beside Pem's (a hidden correction, engine
        # « … → proposition »): Pem takes it or keeps his words (Pem 2026-11-23: « show the suggestion and I'll decide »).
        human = sb.select_all(
            "journal_entry",
            "select=voice_note_id,corrects_id,verification,provenance&voice_note_id=not.is.null&verification=eq.verified&order=id.asc",
        )
        human_notes = {r["voice_note_id"] for r in human}
    roots: dict[str, dict] = {}
    if has_source:
        for r in sb.select_all("journal_entry", "select=id,voice_note_id,kind,event_on,event_precision,body,corrects_id&voice_note_id=not.is.null&corrects_id=is.null&order=created_at.asc"):
            roots.setdefault(r["voice_note_id"], r)

    todo = [n for n in notes if n["id"] not in done]
    total_s = sum((n.get("duration_ms") or 0) for n in todo) / 1000
    print(f"Voice notes with audio: {len(notes)} · already transcribed by {engine}: {len(notes) - len(todo)} · to do: {len(todo)}")
    for n in todo:
        secs = (n.get("duration_ms") or 0) / 1000
        print(f"  {paris_date(n['created_at'])}  {secs:6.0f} s  {n['id']}  {(n.get('subject') or '')[:50]}")
    print(f"Audio to transcribe: {total_s / 60:.1f} min (GPU: roughly a tenth of that, plus model load)")

    if not args.run:
        print("\nList only. Add --run to transcribe (no database write), --run --write to add journal entries.")
        return
    if args.write and not has_source:
        sys.exit("--write refused: apply supabase/sql/journal_entry_source.sql first (voice_note_id / engine columns).")
    if not todo:
        return

    model_dir = MODELS_DIR / f"faster-whisper-{args.model}"
    if not (model_dir / "model.bin").exists():
        sys.exit(
            f"Model not found: {model_dir}\n"
            f"Fetch it once with:  python scripts\\transcribe\\fetch_whisper_model.py {args.model}"
        )
    public_r2 = env.get("NEXT_PUBLIC_R2_PUBLIC_URL", "").rstrip("/")
    if not public_r2:
        sys.exit("NEXT_PUBLIC_R2_PUBLIC_URL missing in .env.local")

    prompt = None
    if args.words:
        prompt = ", ".join(w.strip() for w in open(args.words, encoding="utf-8").read().splitlines() if w.strip())

    add_cuda_dll_dirs()
    from faster_whisper import WhisperModel  # imported after the DLL path is set

    t0 = time.time()
    try:
        model = WhisperModel(str(model_dir), device=args.device, compute_type="float16" if args.device == "cuda" else "int8")
    except Exception as err:  # noqa: BLE001 — fall back rather than stop the batch
        print(f"GPU load failed ({err}); using CPU int8 — slower.")
        model = WhisperModel(str(model_dir), device="cpu", compute_type="int8")
    print(f"Model loaded in {time.time() - t0:.0f} s")

    out_dir = OUT_ROOT / "voice"
    out_dir.mkdir(parents=True, exist_ok=True)

    for n in todo:
        ext = (n.get("audio_mime") or "audio/webm").split("/")[-1].split(";")[0]
        audio = out_dir / f"{n['id']}.{ext}"
        try:
            if not audio.exists():
                download(f"{public_r2}/{quote_key(n['audio_r2_key'])}", audio)
            t1 = time.time()
            segments, info = model.transcribe(
                str(audio), language=args.language, vad_filter=True, beam_size=5, initial_prompt=prompt
            )
            text = clean_text("\n".join(s.text.strip() for s in segments if s.text.strip()))
            if not text:  # short clip: the voice filter may have cut it all — once more without it
                segments, info = model.transcribe(
                    str(audio), language=args.language, vad_filter=False, beam_size=5, initial_prompt=prompt
                )
                text = clean_text("\n".join(s.text.strip() for s in segments if s.text.strip()))
        except Exception as err:  # noqa: BLE001 — one bad file must not stop the rest
            print(f"  FAILED {n['id']}: {err}")
            continue

        result = {
            "voice_note_id": n["id"],
            "event_on": paris_date(n["created_at"]),
            "engine": engine,
            "language": info.language,
            "seconds_audio": round(info.duration, 1),
            "seconds_taken": round(time.time() - t1, 1),
            "text": text,
        }
        (out_dir / f"{n['id']}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  {result['event_on']}  {info.language}  {result['seconds_audio']} s audio in {result['seconds_taken']} s  -> {len(text)} chars")

        root = roots.get(n["id"])
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        entry_engine = engine
        if root and n["id"] in human_notes:
            # Pem's words stand: the PC text is kept as a proposal (hidden correction), never shown in place.
            if args.write:
                fresh = sb.select("journal_entry", f"select=event_on,event_precision&id=eq.{root['id']}")
                day = fresh[0] if fresh else root
                entry = sb.insert(
                    "journal_entry",
                    {
                        "kind": root["kind"],
                        "body": text or NOTHING_HEARD,
                        "provenance": "voice",
                        "verification": "unverified",
                        "event_on": day["event_on"],
                        "event_precision": day.get("event_precision") or "day",
                        "author_id": n.get("user_id"),
                        "voice_note_id": n["id"],
                        "engine": f"{engine} → proposition",
                        "corrects_id": root["id"],
                        "hidden_at": now_iso,
                        "ai_links_at": now_iso,
                    },
                )
                print(f"    proposal {entry['id']} kept beside Pem's words (entry {root['id']})")
            continue
        if not text:
            phone = clean_text(n.get("transcript") or "")
            if root and root.get("body", "").strip() != WAITING_TRANSCRIPT:
                # The phone's words stand: a correction with the same words, engine « … → rien entendu (mots du
                # téléphone gardés) », marks the note as done in the database (readers show no « original »).
                text, entry_engine = root["body"], f"{engine} → {NOTHING_HEARD_ENGINE} (mots du téléphone gardés)"
                print("    empty transcript — the phone's words are kept; the note is marked done")
            elif phone and not root:
                text, entry_engine = phone, f"{engine} → dictée téléphone"
                print(f"    empty transcript — the phone's dictation is used ({len(text)} chars)")
            else:
                text, entry_engine = NOTHING_HEARD, f"{engine} → {NOTHING_HEARD_ENGINE}"
                print("    empty transcript, no phone words either — written as « rien entendu » for Pem to fill")
        if args.write:
            row = {
                "kind": root["kind"] if root else "voice",
                "body": text,
                "provenance": "voice",
                "verification": "unverified",
                "event_on": root["event_on"] if root else result["event_on"],
                "author_id": n.get("user_id"),
                "voice_note_id": n["id"],
                "engine": entry_engine,
            }
            if root:
                # A correction of the phone's entry: same day — read again now, the entry may have been moved
                # meanwhile (« Placer sur un autre jour ») — and no AI link proposals of its own.
                fresh = sb.select("journal_entry", f"select=event_on,event_precision&id=eq.{root['id']}")
                if fresh:
                    row["event_on"] = fresh[0]["event_on"]
                    root["event_precision"] = fresh[0].get("event_precision") or "day"
                row.update({"corrects_id": root["id"], "event_precision": root.get("event_precision") or "day", "ai_links_at": now_iso})
            elif text == NOTHING_HEARD:
                row["ai_links_at"] = now_iso
            entry = sb.insert("journal_entry", row)
            print(f"    journal entry {entry['id']} added" + (f" (correction of {root['id']})" if root else ""))

    print(f"\nLocal files: {out_dir}")
    if args.write:
        print("Next: npm run embed:worker -- --drain  (indexes the new entries for search and suggestions)")


if __name__ == "__main__":
    main()
