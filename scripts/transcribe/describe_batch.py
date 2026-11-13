"""Image descriptions for every work with a cover image (owner GO 2026-11-13): gemma3:4b, the
"labelled" observation prompt of round 2 + an "echoes" line (artists / styles it recalls).

  python scripts\\transcribe\\describe_batch.py              list how many works would be described
  python scripts\\transcribe\\describe_batch.py --write      describe and store (public.work_description)
  python scripts\\transcribe\\describe_batch.py --write --limit 20

Stored apart from the owner's text (never in "Commentaires"), marked AI (engine named) and
unverified (supabase/sql/work_description.sql). A work already described for its current cover by
the same engine + prompt is skipped, so the batch can be stopped and restarted. A copy of every
result is also written as JSON under transcribe-out/describe-batch/.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from common import OUT_ROOT, Supabase, download, load_env, quote_key
from handwriting_test import find_ollama, transcribe
from describe_images_test import BAN_LINE, FACTS, UNSURE, banned_hits, lookup, to_jpeg, unload

MODEL = "gemma3:4b"
PROMPT_NAME = "labelled+echoes-v1"
PROMPT = (
    "This is a photograph of one painting or drawing. " + FACTS + "\n"
    "Write only what you can see, as short labelled lines in English:\n"
    "figures: people or animals — how many, posture, gesture, where they look; 'none' if none.\n"
    "objects: the things shown, by their plain names.\n"
    "setting: the place or ground (room, landscape, sea, bare ground, plain colour…).\n"
    "light: where the light comes from and what it falls on; 'flat' if it has no direction.\n"
    "marks: how the paint or line is put down — brush width, scraping, drips, hatching, outlines, "
    "layers showing through, bare support.\n"
    "unusual: the one thing a careful viewer notices first, or 'nothing'.\n"
    "echoes: one to three painters, movements or periods this picture recalls, by name, with a few "
    "words on what recalls them; 'none' if nothing clear.\n"
    "Use concrete nouns and verbs. " + UNSURE + " " + BAN_LINE + " "
    "No word about meaning, mood or quality."
)


def split_echoes(text: str) -> tuple[str, str | None]:
    body, echoes = [], None
    for line in text.splitlines():
        if line.strip().lower().lstrip("*- ").startswith("echoes:"):
            val = line.split(":", 1)[1].strip().strip("*").strip()
            echoes = None if val.lower().rstrip(".") in ("", "none") else val
        elif line.strip():
            body.append(line.strip())
    return "\n".join(body), echoes


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--write", action="store_true", help="describe and store (default: count only)")
    ap.add_argument("--limit", type=int, default=0, help="stop after N works (0 = all)")
    args = ap.parse_args()

    env = load_env()
    sb = Supabase(env)
    public_r2 = env.get("NEXT_PUBLIC_R2_PUBLIC_URL", "").rstrip("/")
    engine = f"ollama {MODEL}"

    cols = "OeuvreID,Titre,txtImageNameLink,Technique,Support,Hauteur,Largeur,Ann%C3%A9e"
    works = sb.select("Oeuvres", f"select={cols}&deleted_at=is.null&txtImageNameLink=not.is.null&order=OeuvreID.asc&limit=5000")
    done_rows = sb.select("work_description", f"select=oeuvre_id,image_key&engine=eq.{quote_key(engine)}&prompt=eq.{quote_key(PROMPT_NAME)}&limit=10000")
    done = {(r["oeuvre_id"], r["image_key"]) for r in done_rows}
    todo = [w for w in works if (w["OeuvreID"], w["txtImageNameLink"]) not in done]
    if args.limit:
        todo = todo[: args.limit]
    print(f"Works with a cover image: {len(works)} · already described ({engine}, {PROMPT_NAME}): {len(works) - len([w for w in works if (w['OeuvreID'], w['txtImageNameLink']) not in done])} · this run: {len(todo)}")
    if not args.write or not todo:
        if not args.write:
            print("Count only. Add --write to describe and store.")
        return

    origin = find_ollama(env, MODEL)
    techniques = lookup(sb, "Technique", "TechniqueID", "Technique")
    supports = lookup(sb, "Support", "SupportID", "Support")
    out_dir = OUT_ROOT / "describe-batch" / time.strftime("%Y%m%d-%H%M%S")
    out_dir.mkdir(parents=True, exist_ok=True)

    t_start, ok, failed, secs = time.time(), 0, 0, []
    for n, w in enumerate(todo, 1):
        oid = w["OeuvreID"]
        key = w["txtImageNameLink"]
        facts = ", ".join(
            f
            for f in [
                f"title '{w['Titre']}'" if (w.get("Titre") or "").strip() else "untitled",
                f"technique {techniques[w['Technique']]}" if w.get("Technique") in techniques else None,
                f"support {supports[w['Support']]}" if w.get("Support") in supports else None,
                f"size {w['Hauteur']} x {w['Largeur']} cm" if w.get("Hauteur") and w.get("Largeur") else None,
                f"year {str(w['Année'])[:4]}" if w.get("Année") else None,
            ]
            if f
        )
        raw = out_dir / f"raw-{oid}.{key.rsplit('.', 1)[-1]}"
        jpeg = out_dir / f"work-{oid}.jpg"
        t0 = time.time()
        try:
            download(f"{public_r2}/{quote_key(key)}", raw)
            to_jpeg(raw, jpeg)
            raw.unlink(missing_ok=True)
            text = transcribe(origin, MODEL, jpeg, PROMPT.format(facts=facts))
            jpeg.unlink(missing_ok=True)
            body, echoes = split_echoes(text)
            if not body:
                raise RuntimeError("empty description")
            sb.insert(
                "work_description",
                {"oeuvre_id": oid, "image_key": key, "engine": engine, "prompt": PROMPT_NAME, "body": body, "echoes": echoes},
            )
            taken = round(time.time() - t0, 1)
            secs.append(taken)
            ok += 1
            (out_dir / f"{oid}.json").write_text(
                json.dumps({"work": oid, "facts": facts, "body": body, "echoes": echoes, "banned": banned_hits(text), "seconds": taken}, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            print(f"  [{n}/{len(todo)}] #{oid:<5} {taken:5.1f} s  {(echoes or '-')[:60]}", flush=True)
        except Exception as err:  # noqa: BLE001 — one bad work must not stop the batch
            failed += 1
            print(f"  [{n}/{len(todo)}] #{oid:<5} FAILED {str(err)[:120]}", flush=True)

    unload(origin, MODEL)
    avg = sum(secs) / len(secs) if secs else 0
    summary = {"stored": ok, "failed": failed, "avg_seconds": round(avg, 1), "minutes": round((time.time() - t_start) / 60, 1)}
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"\nStored {ok}, failed {failed}, {avg:.1f} s per work, {summary['minutes']} min. Copies: {out_dir}")


if __name__ == "__main__":
    main()
