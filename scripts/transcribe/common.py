"""Shared helpers for the transcription batches (journal step 4).

Standard library only. Run with the `transcribe` venv:
  C:\\Users\\pppee\\.venvs\\transcribe\\Scripts\\python.exe scripts\\transcribe\\<script>.py
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
VENV_ROOT = Path(os.environ.get("TRANSCRIBE_VENV", r"C:\Users\pppee\.venvs\transcribe"))
MODELS_DIR = Path(os.environ.get("TRANSCRIBE_MODELS", r"C:\Users\pppee\.venvs\models"))
OUT_ROOT = Path(os.environ.get("TRANSCRIBE_OUT", r"C:\Users\pppee\.venvs\transcribe-out"))


def load_env() -> dict[str, str]:
    """Read .env.local (KEY=value lines). Values are never printed."""
    env: dict[str, str] = {}
    path = REPO_ROOT / ".env.local"
    if not path.exists():
        sys.exit(f".env.local not found at {path}")
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def add_cuda_dll_dirs() -> None:
    """faster-whisper needs cuBLAS / cuDNN DLLs shipped in the venv (nvidia/*/bin)."""
    base = VENV_ROOT / "Lib" / "site-packages" / "nvidia"
    if not base.exists():
        return
    for bin_dir in base.glob("*/bin"):
        os.add_dll_directory(str(bin_dir))
        os.environ["PATH"] = str(bin_dir) + os.pathsep + os.environ.get("PATH", "")


class Supabase:
    """Minimal PostgREST client with the service-role key (this PC only)."""

    def __init__(self, env: dict[str, str]):
        self.url = env.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
        self.key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not self.url or not self.key:
            sys.exit("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env.local")

    def _request(self, method: str, path: str, body: object | None = None, prefer: str | None = None):
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(f"{self.url}/rest/v1/{path}", data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                raw = res.read().decode("utf-8")
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as err:
            detail = err.read().decode("utf-8", "replace")[:300]
            raise RuntimeError(f"{method} {path.split('?')[0]} -> {err.code}: {detail}") from None

    def select(self, table: str, query: str):
        return self._request("GET", f"{table}?{query}") or []

    def insert(self, table: str, row: dict):
        rows = self._request("POST", table, row, prefer="return=representation")
        return rows[0] if rows else None

    def has_columns(self, table: str, columns: list[str]) -> bool:
        try:
            self._request("GET", f"{table}?select={','.join(columns)}&limit=0")
            return True
        except RuntimeError:
            return False


def _last_sunday(year: int, month: int) -> dt.date:
    day = dt.date(year, month + 1, 1) - dt.timedelta(days=1)
    return day - dt.timedelta(days=(day.weekday() + 1) % 7)


def paris_date(iso_utc: str) -> str:
    """UTC timestamp -> calendar date in Paris (EU summer-time rule, no tzdata needed)."""
    stamp = dt.datetime.fromisoformat(iso_utc.replace("Z", "+00:00")).astimezone(dt.timezone.utc)
    start = dt.datetime.combine(_last_sunday(stamp.year, 3), dt.time(1), dt.timezone.utc)
    end = dt.datetime.combine(_last_sunday(stamp.year, 10), dt.time(1), dt.timezone.utc)
    offset = 2 if start <= stamp < end else 1
    return (stamp + dt.timedelta(hours=offset)).date().isoformat()


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "transcribe-batch"})
    with urllib.request.urlopen(req, timeout=120) as res, open(dest, "wb") as fh:
        while chunk := res.read(1 << 20):
            fh.write(chunk)


def quote_key(key: str) -> str:
    return urllib.parse.quote(key, safe="/")
