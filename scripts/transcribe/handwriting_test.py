"""Handwriting test (journal step 4 B): page photos -> transcript, side by side. NOTHING is written
to the database or to R2.

  python scripts\\transcribe\\handwriting_test.py "C:\\Users\\pppee\\Pictures\\carnet-2026-test"

One photo per page, upright, file names in page order (JPEG / PNG / HEIC / WebP). Output: an HTML
report (photo · transcript) + JSON in the transcribe-out folder; the path is printed at the end.

Options: --model qwen2.5vl:7b   --limit 10   --language fr|en|mixed (hint only)
"""
from __future__ import annotations

import argparse
import base64
import html
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from common import OUT_ROOT, load_env

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".tif", ".tiff"}
LONG_SIDE = 2000

PROMPT = (
    "This is a photo of a handwritten notebook page{lang}. Transcribe the handwriting exactly as "
    "written.\n"
    "- Keep the original language, spelling, punctuation and line breaks. Do not translate, correct "
    "or summarise.\n"
    "- A word you cannot read: write [?]. A word you are unsure of: write it followed by [?].\n"
    "- Crossed-out text: ~~like this~~. A drawing or diagram: [drawing: three or four words].\n"
    "- Output only the transcription, nothing before or after."
)


def find_ollama(env: dict[str, str], model: str) -> str:
    origins = [env.get("OLLAMA_ORIGIN", ""), "http://127.0.0.1:11434", "http://127.0.0.1:11435"]
    for origin in dict.fromkeys(o.rstrip("/") for o in origins if o):
        try:
            with urllib.request.urlopen(f"{origin}/api/tags", timeout=5) as res:
                names = {m["name"] for m in json.loads(res.read()).get("models", [])}
        except (urllib.error.URLError, OSError):
            continue
        if model in names:
            return origin
        print(f"Ollama at {origin} has no {model} (has: {', '.join(sorted(names)) or 'nothing'})")
    sys.exit(f"No running Ollama with {model}. Start Ollama, or: ollama pull {model}")


def to_jpeg(src: Path, dest: Path) -> None:
    """Upright JPEG, long side <= LONG_SIDE (ffmpeg applies the photo's rotation tag)."""
    scale = f"scale='if(gt(iw,ih),min({LONG_SIDE},iw),-2)':'if(gt(iw,ih),-2,min({LONG_SIDE},ih))'"
    proc = subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vf", scale, "-frames:v", "1", "-q:v", "3", str(dest)],
        capture_output=True, text=True,
    )
    if proc.returncode != 0 or not dest.exists():
        raise RuntimeError(proc.stderr.strip()[:200] or "ffmpeg could not read this image")


def transcribe(origin: str, model: str, jpeg: Path, prompt: str) -> str:
    body = {
        "model": model,
        "stream": False,
        "options": {"temperature": 0, "num_ctx": 8192},
        "messages": [{"role": "user", "content": prompt, "images": [base64.b64encode(jpeg.read_bytes()).decode()]}],
    }
    req = urllib.request.Request(
        f"{origin}/api/chat", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=900) as res:
        return json.loads(res.read())["message"]["content"].strip()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder")
    ap.add_argument("--model", default="qwen2.5vl:7b")
    ap.add_argument("--limit", type=int, default=10)
    ap.add_argument("--language", choices=["fr", "en", "mixed"], help="hint for the model")
    args = ap.parse_args()

    folder = Path(args.folder)
    if not folder.is_dir():
        sys.exit(f"Not a folder: {folder}")
    pages = sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_EXT)[: args.limit]
    if not pages:
        sys.exit(f"No page photos in {folder}")

    env = load_env()
    origin = find_ollama(env, args.model)
    lang = {"fr": " in French", "en": " in English", "mixed": " in French and English"}.get(args.language or "", "")
    prompt = PROMPT.format(lang=lang)

    out_dir = OUT_ROOT / "handwriting" / f"{folder.name}-{time.strftime('%Y%m%d-%H%M%S')}"
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"{len(pages)} page(s) · {args.model} at {origin}\n")

    results = []
    for i, page in enumerate(pages, 1):
        jpeg = out_dir / f"page-{i:03d}.jpg"
        t0 = time.time()
        try:
            to_jpeg(page, jpeg)
            text = transcribe(origin, args.model, jpeg, prompt)
            error = None
        except Exception as err:  # noqa: BLE001 — one bad page must not stop the test
            text, error = "", str(err)
        taken = round(time.time() - t0, 1)
        unsure = text.count("[?]")
        words = len(text.split())
        results.append({"page": i, "file": page.name, "jpeg": jpeg.name, "seconds": taken, "words": words, "unsure": unsure, "error": error, "text": text})
        print(f"  {i:>3}  {page.name[:40]:40}  {taken:6.1f} s  {words:4} words  {unsure:3} unsure" + (f"  ERROR {error}" if error else ""))

    (out_dir / "result.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    rows = "".join(
        f"<section><h2>Page {r['page']} · {html.escape(r['file'])}</h2>"
        f"<p class=m>{r['seconds']} s · {r['words']} words · {r['unsure']} marked unsure"
        + (f" · <b>error: {html.escape(r['error'])}</b>" if r["error"] else "")
        + f"</p><div class=g><img src='{r['jpeg']}' alt='page {r['page']}'><pre>{html.escape(r['text'])}</pre></div></section>"
        for r in results
    )
    total_s = sum(r["seconds"] for r in results)
    (out_dir / "report.html").write_text(
        "<!doctype html><meta charset=utf-8><title>Handwriting test</title>"
        "<style>body{font:15px/1.5 system-ui;margin:24px;background:#faf9f6;color:#222}"
        ".g{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}img{width:100%;border:1px solid #ccc}"
        "pre{white-space:pre-wrap;font:15px/1.6 Georgia,serif;background:#fff;border:1px solid #ccc;padding:12px;margin:0}"
        "section{margin-bottom:40px}.m{color:#666}@media(max-width:800px){.g{grid-template-columns:1fr}}</style>"
        f"<h1>Handwriting test · {html.escape(folder.name)}</h1>"
        f"<p class=m>{html.escape(args.model)} · {len(results)} pages · {total_s:.0f} s in all · nothing was saved to the database. "
        "[?] = the model could not read or was unsure. Read each page against its photo and count the wrong words.</p>"
        + rows,
        encoding="utf-8",
    )
    print(f"\nReport: {out_dir / 'report.html'}")


if __name__ == "__main__":
    main()
