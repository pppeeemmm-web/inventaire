"""Image description test, round 2: what local vision models see in a sample of works. NOTHING is
written to the database.

  python scripts\\transcribe\\describe_images_test.py                       20 works spread over the catalogue
  python scripts\\transcribe\\describe_images_test.py --same <result.json>  the works of an earlier run
  python scripts\\transcribe\\describe_images_test.py --models qwen2.5vl:7b,gemma3:4b --variants labelled,inventory

Round 2 (owner 2026-11-13): observation, not art-speak — concrete nouns and verbs, labelled lines,
generic words banned, catalogue facts given so the model stops guessing them. Several prompt
variants and models side by side in one report.html, with real seconds per image.
Models run one after the other (each unloaded before the next): the GPU has 8 GB.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
import time
import urllib.request
from pathlib import Path

from common import OUT_ROOT, Supabase, download, load_env, quote_key
from handwriting_test import find_ollama, transcribe

BANNED = [
    "artwork", "composition", "abstract", "dominant", "appears", "seems", "technique", "visible",
    "textured", "texture", "evokes", "evoke", "palette", "vibrant", "striking", "suggests", "conveys",
]
BAN_LINE = "Never use these words: " + ", ".join(BANNED) + "."
FACTS = "Catalogue facts (true; do not repeat them, do not guess them): {facts}."
UNSURE = "If you are not sure what something is, say what it looks like (e.g. 'a dark oval, maybe a head')."

VARIANTS = {
    # Labelled lines, one aspect each — what the brief asked for.
    "labelled": (
        "This is a photograph of one painting or drawing. " + FACTS + "\n"
        "Write only what you can see, as short labelled lines in English:\n"
        "figures: people or animals — how many, posture, gesture, where they look; 'none' if none.\n"
        "objects: the things shown, by their plain names.\n"
        "setting: the place or ground (room, landscape, sea, bare ground, plain colour…).\n"
        "light: where the light comes from and what it falls on; 'flat' if it has no direction.\n"
        "marks: how the paint or line is put down — brush width, scraping, drips, hatching, outlines, "
        "layers showing through, bare support.\n"
        "unusual: the one thing a careful viewer notices first, or 'nothing'.\n"
        "Use concrete nouns and verbs. " + UNSURE + " " + BAN_LINE + " "
        "No word about meaning, mood or quality."
    ),
    # An inventory, largest thing first — good raw material for search.
    "inventory": (
        "This is a photograph of one painting or drawing. " + FACTS + "\n"
        "Make an inventory of what is in the picture, as a careful cataloguer would, in English: "
        "at most 12 short lines, one thing per line, the noun first, then where it is and its colour "
        "(e.g. 'woman, left, seated, back turned, red dress'). Start with the largest thing. "
        "Last line: 'marks: ' and how the paint or line is put down (brush width, scraping, drips, "
        "hatching, outlines, bare support). " + UNSURE + " " + BAN_LINE + " No sentences, no comment."
    ),
}


def to_jpeg(src: Path, dest: Path) -> None:
    """sharp (the app's own decoder) — ffmpeg could not read 5 of the 20 AVIFs in round 1."""
    script = Path(__file__).with_name("to_jpeg.mjs")
    proc = subprocess.run(["node", str(script), str(src), str(dest)], capture_output=True, text=True)
    if proc.returncode != 0 or not dest.exists():
        raise RuntimeError((proc.stderr or "image conversion failed").strip()[:200])


def unload(origin: str, model: str) -> None:
    body = json.dumps({"model": model, "keep_alive": 0}).encode()
    req = urllib.request.Request(f"{origin}/api/generate", data=body, headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=60).read()
    except OSError:
        pass  # not loaded — nothing to free


def banned_hits(text: str) -> list[str]:
    low = text.lower()
    return [w for w in BANNED if re.search(rf"\b{re.escape(w)}\b", low)]


def lookup(sb: Supabase, table: str, id_col: str, name_col: str) -> dict[int, str]:
    return {r[id_col]: r[name_col] for r in sb.select(table, f"select={id_col},{name_col}") if r.get(name_col)}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--count", type=int, default=20)
    ap.add_argument("--same", help="result.json of an earlier run: describe the same works")
    ap.add_argument("--models", default="qwen2.5vl:7b,gemma3:4b")
    ap.add_argument("--variants", default="labelled,inventory")
    args = ap.parse_args()
    models = [m.strip() for m in args.models.split(",") if m.strip()]
    variants = [v.strip() for v in args.variants.split(",") if v.strip() in VARIANTS]

    env = load_env()
    sb = Supabase(env)
    public_r2 = env.get("NEXT_PUBLIC_R2_PUBLIC_URL", "").rstrip("/")
    origins = {m: find_ollama(env, m) for m in models}

    cols = "OeuvreID,Titre,Commentaires,txtImageNameLink,Technique,Support,Hauteur,Largeur,Ann%C3%A9e"
    works = sb.select("Oeuvres", f"select={cols}&deleted_at=is.null&txtImageNameLink=not.is.null&order=OeuvreID.asc&limit=3000")
    if args.same:
        ids = [r["work"] for r in json.loads(Path(args.same).read_text(encoding="utf-8"))]
        by_id = {w["OeuvreID"]: w for w in works}
        sample = [by_id[i] for i in ids if i in by_id]
    else:
        step = max(1, len(works) // args.count)
        sample = works[step // 2 :: step][: args.count]
    techniques = lookup(sb, "Technique", "TechniqueID", "Technique")
    supports = lookup(sb, "Support", "SupportID", "Support")

    out_dir = OUT_ROOT / "describe" / time.strftime("%Y%m%d-%H%M%S")
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. Images once, shared by every model and variant.
    rows = []
    for w in sample:
        oid = w["OeuvreID"]
        raw = out_dir / f"raw-{oid}.{w['txtImageNameLink'].rsplit('.', 1)[-1]}"
        jpeg = out_dir / f"work-{oid}.jpg"
        facts = [
            f"title '{w['Titre']}'" if (w.get("Titre") or "").strip() else "untitled",
            f"technique {techniques[w['Technique']]}" if w.get("Technique") in techniques else None,
            f"support {supports[w['Support']]}" if w.get("Support") in supports else None,
            f"size {w['Hauteur']} x {w['Largeur']} cm" if w.get("Hauteur") and w.get("Largeur") else None,
            f"year {str(w['Année'])[:4]}" if w.get("Année") else None,
        ]
        row = {"work": oid, "title": w.get("Titre") or "", "comments": w.get("Commentaires") or "",
               "facts": ", ".join(f for f in facts if f), "jpeg": jpeg.name, "error": None, "out": {}}
        try:
            download(f"{public_r2}/{quote_key(w['txtImageNameLink'])}", raw)
            to_jpeg(raw, jpeg)
            raw.unlink(missing_ok=True)
        except Exception as err:  # noqa: BLE001 — one bad image must not stop the test
            row["error"] = str(err)
        rows.append(row)
    print(f"{len(rows)} works, {sum(1 for r in rows if not r['error'])} images ready · models {models} · variants {variants}\n")

    # 2. One model at a time, every variant, then unload it.
    timing: dict[str, dict] = {}
    for model in models:
        origin = origins[model]
        loaded = False
        for variant in variants:
            key = f"{model} · {variant}"
            secs, first = [], None
            for r in rows:
                if r["error"]:
                    continue
                prompt = VARIANTS[variant].format(facts=r["facts"])
                t0 = time.time()
                try:
                    text, err = transcribe(origin, model, out_dir / r["jpeg"], prompt), None
                except Exception as e:  # noqa: BLE001
                    text, err = "", str(e)
                taken = round(time.time() - t0, 1)
                if not loaded:
                    first, loaded = taken, True  # includes loading the model
                else:
                    secs.append(taken)
                r["out"][key] = {"text": text, "error": err, "seconds": taken, "banned": banned_hits(text)}
                print(f"  {key:<32} #{r['work']:<5} {taken:5.1f} s  {(err or text).replace(chr(10), ' / ')[:70]}")
            timing[key] = {"first_with_load": first, "avg_after": round(sum(secs) / len(secs), 1) if secs else None,
                           "errors": sum(1 for r in rows if r["out"].get(key, {}).get("error")),
                           "banned_total": sum(len(r["out"].get(key, {}).get("banned", [])) for r in rows)}
        unload(origin, model)

    (out_dir / "result.json").write_text(json.dumps({"timing": timing, "rows": rows}, ensure_ascii=False, indent=2), encoding="utf-8")

    keys = list(timing)
    head = "".join(
        f"<th>{html.escape(k)}<br><span class=m>{t['avg_after']} s/image · "
        + (f"first {t['first_with_load']} s (model load) · " if t['first_with_load'] is not None else "")
        + f"{t['errors']} errors · {t['banned_total']} banned words</span></th>"
        for k, t in timing.items()
    )

    def cell(o: dict | None) -> str:
        if not o:
            return "<td class=m>—</td>"
        if o["error"]:
            return f"<td><b>error: {html.escape(o['error'])}</b></td>"
        ban = f"<p class=b>banned: {', '.join(o['banned'])}</p>" if o["banned"] else ""
        return f"<td><pre>✦ {html.escape(o['text'])}</pre>{ban}<p class=m>{o['seconds']} s</p></td>"

    body = "".join(
        f"<tr><td class=w><img src='{r['jpeg']}' alt=''><h2>#{r['work']} {html.escape(r['title']) or '<i>untitled</i>'}</h2>"
        f"<p class=m>Given to the model: {html.escape(r['facts'])}</p>"
        + (f"<p class=m>Catalogue comment: {html.escape(r['comments'][:300])}</p>" if r["comments"] else "")
        + (f"<p><b>image error: {html.escape(r['error'])}</b></p>" if r["error"] else "")
        + "</td>" + "".join(cell(r["out"].get(k)) for k in keys) + "</tr>"
        for r in rows
    )
    (out_dir / "report.html").write_text(
        "<!doctype html><meta charset=utf-8><title>Image description test — round 2</title>"
        "<style>body{font:14px/1.45 system-ui;margin:20px;background:#faf9f6;color:#222}"
        "table{border-collapse:collapse;width:100%}th{position:sticky;top:0;background:#eee;text-align:left;vertical-align:top}"
        "th,td{border:1px solid #ccc;padding:8px;vertical-align:top}td.w{width:260px}img{width:100%;border:1px solid #ccc}"
        "pre{white-space:pre-wrap;font:14px/1.5 Georgia,serif;margin:0}.m{color:#666;font-size:12px}.b{color:#a33;font-size:12px}"
        "h2{margin:6px 0;font-size:15px}</style>"
        "<h1>Image description test — round 2</h1><p class=m>Nothing was saved to the database. ✦ = written by a model. "
        "Seconds per image exclude the first image of each column (model load). GPU used by nothing else.</p>"
        f"<table><tr><th>Work</th>{head}</tr>{body}</table>",
        encoding="utf-8",
    )
    for k, t in timing.items():
        load = f" (first {t['first_with_load']} s, model load)" if t["first_with_load"] is not None else ""
        print(f"{k:<32} {t['avg_after']} s/image{load} · {t['errors']} errors · {t['banned_total']} banned words")
    print(f"Report: {out_dir / 'report.html'}")


if __name__ == "__main__":
    main()
