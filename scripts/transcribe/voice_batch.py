"""Voice notes -> transcripts (faster-whisper on this PC's GPU). Journal step 4 A.

  python scripts\\transcribe\\voice_batch.py                 list what would be transcribed (reads only)
  python scripts\\transcribe\\voice_batch.py --run           transcribe to local JSON files (no database write)
  python scripts\\transcribe\\voice_batch.py --run --write   also add each transcript as a journal entry

Rules (docs/TRANSCRIPTION_BATCHES.md): the audio stays the reference; a transcript is ADDED as a
journal entry (kind voice, provenance voice, unverified, engine named); the dictation text on the
note is never touched; a note already transcribed by the same engine is skipped.

--write needs supabase/sql/journal_entry_source.sql applied (voice_note_id / engine columns).
Options: --model large-v3 (folder under the models dir)  --words words.txt (names, art terms)
         --only <voice_note id>  --language fr|en (default: detected per note)
"""
from __future__ import annotations

import argparse
import json
import sys
import time

from common import MODELS_DIR, OUT_ROOT, Supabase, add_cuda_dll_dirs, download, load_env, paris_date, quote_key

SOURCE_COLUMNS = ["voice_note_id", "engine"]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--run", action="store_true", help="transcribe (default: list only)")
    ap.add_argument("--write", action="store_true", help="add transcripts to the journal (needs --run)")
    ap.add_argument("--model", default="large-v3")
    ap.add_argument("--words", help="text file of names / terms to help spelling")
    ap.add_argument("--only", help="one voice_note id")
    ap.add_argument("--language", help="force fr / en (default: auto)")
    args = ap.parse_args()

    env = load_env()
    sb = Supabase(env)
    engine = f"faster-whisper {args.model}"

    query = (
        "select=id,created_at,user_id,subject,audio_r2_key,audio_mime,duration_ms,oeuvre_id,concept_id"
        "&audio_r2_key=not.is.null&order=created_at.asc"
    )
    if args.only:
        query += f"&id=eq.{args.only}"
    notes = sb.select("voice_note", query)

    has_source = sb.has_columns("journal_entry", SOURCE_COLUMNS)
    done: set[str] = set()
    if has_source:
        rows = sb.select("journal_entry", f"select=voice_note_id&engine=eq.{engine.replace(' ', '%20')}&voice_note_id=not.is.null")
        done = {r["voice_note_id"] for r in rows}

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
        model = WhisperModel(str(model_dir), device="cuda", compute_type="float16")
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
            text = "\n".join(s.text.strip() for s in segments if s.text.strip())
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

        if not text:
            print("    empty transcript — nothing written")
            continue
        if args.write:
            entry = sb.insert(
                "journal_entry",
                {
                    "kind": "voice",
                    "body": text,
                    "provenance": "voice",
                    "verification": "unverified",
                    "event_on": result["event_on"],
                    "author_id": n.get("user_id"),
                    "voice_note_id": n["id"],
                    "engine": engine,
                },
            )
            print(f"    journal entry {entry['id']} added")

    print(f"\nLocal files: {out_dir}")
    if args.write:
        print("Next: npm run embed:worker -- --drain  (indexes the new entries for search and suggestions)")


if __name__ == "__main__":
    main()
