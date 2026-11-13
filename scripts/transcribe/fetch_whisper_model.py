"""Fetch a faster-whisper model once, with curl (Python downloads from Hugging Face were reset
by the host on 2026-11-12).

  python scripts\\transcribe\\fetch_whisper_model.py large-v3         (~3.1 GB, best quality)
  python scripts\\transcribe\\fetch_whisper_model.py large-v3-turbo   (~1.6 GB, faster)

Source: https://huggingface.co/Systran/faster-whisper-large-v3 (the faster-whisper project's own
conversions); turbo: https://huggingface.co/deepdml/faster-whisper-large-v3-turbo-ct2
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from common import MODELS_DIR

REPOS = {
    "large-v3": "Systran/faster-whisper-large-v3",
    "large-v3-turbo": "deepdml/faster-whisper-large-v3-turbo-ct2",
    "medium": "Systran/faster-whisper-medium",
    "small": "Systran/faster-whisper-small",
}
FILES = ["config.json", "preprocessor_config.json", "tokenizer.json", "vocabulary.json", "model.bin"]


def find_curl() -> str:
    """Windows' own curl.exe fails the TLS handshake with this host (exit 35, seen 2026-11-13);
    Git's curl works. Override with the CURL environment variable."""
    if os.environ.get("CURL"):
        return os.environ["CURL"]
    for candidate in (r"C:\Program Files\Git\mingw64\bin\curl.exe", r"C:\Program Files (x86)\Git\mingw64\bin\curl.exe"):
        if Path(candidate).exists():
            return candidate
    return "curl"


def main() -> None:
    curl = find_curl()
    name = sys.argv[1] if len(sys.argv) > 1 else "large-v3"
    if name not in REPOS:
        sys.exit(f"Unknown model {name}. Choices: {', '.join(REPOS)}")
    dest = MODELS_DIR / f"faster-whisper-{name}"
    dest.mkdir(parents=True, exist_ok=True)
    for file in FILES:
        url = f"https://huggingface.co/{REPOS[name]}/resolve/main/{file}"
        print(f"{file} …")
        # -C - resumes a partial download; -f fails on HTTP errors (some repos lack preprocessor_config.json)
        code = subprocess.call([curl, "-L", "-f", "-C", "-", "--retry", "40", "--retry-all-errors", "--retry-delay", "3", "-o", str(dest / file), url])
        if code != 0 and file != "preprocessor_config.json":
            sys.exit(f"Download failed for {file} (curl exit {code}). Run again to resume.")
    print(f"Done: {dest}")


if __name__ == "__main__":
    main()
