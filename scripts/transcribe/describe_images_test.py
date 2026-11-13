"""Image description test: what the local vision model says about a sample of works. NOTHING is
written to the database.

  python scripts\\transcribe\\describe_images_test.py            20 works spread over the catalogue
  python scripts\\transcribe\\describe_images_test.py --count 40 --language fr

Output: report.html (image · description · what the catalogue already says) in transcribe-out.
Purpose: decide whether such descriptions are good enough to be added (marked AI, unverified) to
the search text of untitled works.
"""
from __future__ import annotations

import argparse
import html
import json
import time

from common import OUT_ROOT, Supabase, download, load_env, quote_key
from handwriting_test import find_ollama, to_jpeg, transcribe

PROMPT = (
    "This is a photograph of an artwork (painting, drawing or mixed media). Describe what is "
    "visible in two or three plain sentences{lang}: the subject or motif, the composition, the "
    "dominant colours and the visible technique or texture. If it is abstract, say so and describe "
    "shapes and colours. Do not interpret its meaning, do not praise it, do not guess the artist. "
    "Output only the description."
)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--count", type=int, default=20)
    ap.add_argument("--model", default="qwen2.5vl:7b")
    ap.add_argument("--language", choices=["en", "fr"], default="en")
    args = ap.parse_args()

    env = load_env()
    sb = Supabase(env)
    public_r2 = env.get("NEXT_PUBLIC_R2_PUBLIC_URL", "").rstrip("/")
    origin = find_ollama(env, args.model)

    works = sb.select(
        "Oeuvres",
        "select=OeuvreID,Titre,Commentaires,txtImageNameLink&deleted_at=is.null&txtImageNameLink=not.is.null&order=OeuvreID.asc&limit=3000",
    )
    step = max(1, len(works) // args.count)
    sample = works[step // 2 :: step][: args.count]
    prompt = PROMPT.format(lang=" in French" if args.language == "fr" else "")

    out_dir = OUT_ROOT / "describe" / time.strftime("%Y%m%d-%H%M%S")
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"{len(sample)} of {len(works)} works · {args.model} at {origin}\n")

    results = []
    for w in sample:
        oid = w["OeuvreID"]
        raw = out_dir / f"raw-{oid}{'.' + w['txtImageNameLink'].rsplit('.', 1)[-1]}"
        jpeg = out_dir / f"work-{oid}.jpg"
        t0 = time.time()
        try:
            download(f"{public_r2}/{quote_key(w['txtImageNameLink'])}", raw)
            to_jpeg(raw, jpeg)
            raw.unlink(missing_ok=True)
            text, error = transcribe(origin, args.model, jpeg, prompt), None
        except Exception as err:  # noqa: BLE001 — one bad image must not stop the test
            text, error = "", str(err)
        taken = round(time.time() - t0, 1)
        results.append({"work": oid, "title": w.get("Titre") or "", "comments": w.get("Commentaires") or "", "jpeg": jpeg.name, "seconds": taken, "error": error, "text": text})
        print(f"  #{oid:<5} {taken:5.1f} s  {(error or text)[:90]}")

    (out_dir / "result.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    ok = [r for r in results if not r["error"]]
    avg = sum(r["seconds"] for r in ok) / len(ok) if ok else 0
    rows = "".join(
        f"<section><img src='{r['jpeg']}' alt=''><div><h2>#{r['work']} {html.escape(r['title']) or '<i>untitled</i>'}</h2>"
        + (f"<p class=m>Catalogue comment: {html.escape(r['comments'][:300])}</p>" if r["comments"] else "")
        + (f"<p><b>error: {html.escape(r['error'])}</b></p>" if r["error"] else f"<p class=d>✦ {html.escape(r['text'])}</p>")
        + f"<p class=m>{r['seconds']} s</p></div></section>"
        for r in results
    )
    (out_dir / "report.html").write_text(
        "<!doctype html><meta charset=utf-8><title>Image description test</title>"
        "<style>body{font:15px/1.5 system-ui;margin:24px;background:#faf9f6;color:#222;max-width:1100px}"
        "section{display:grid;grid-template-columns:320px 1fr;gap:20px;margin-bottom:28px;align-items:start}"
        "img{width:100%;border:1px solid #ccc}.d{font:16px/1.6 Georgia,serif;background:#fff;border:1px solid #ccc;padding:12px}"
        ".m{color:#666}h2{margin:0 0 6px;font-size:17px}@media(max-width:700px){section{grid-template-columns:1fr}}</style>"
        f"<h1>Image description test</h1><p class=m>{html.escape(args.model)} · {len(results)} works · average {avg:.1f} s per image · "
        "nothing was saved to the database. ✦ = written by the model.</p>" + rows,
        encoding="utf-8",
    )
    print(f"\nAverage {avg:.1f} s per image. Report: {out_dir / 'report.html'}")


if __name__ == "__main__":
    main()
