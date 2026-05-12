#!/usr/bin/env bash
# Phase E — dump Supabase Postgres and upload gzipped SQL to R2 backup bucket.
# Required env (set as GitHub Actions secrets):
#   SUPABASE_DB_URL        — full connection string (postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres)
#   R2_BACKUP_ACCOUNT_ID   — Cloudflare account id
#   R2_BACKUP_ACCESS_KEY   — R2 token access key (scoped: write to backup bucket only)
#   R2_BACKUP_SECRET_KEY   — R2 token secret key
#   R2_BACKUP_BUCKET       — bucket name (e.g. art-db-backups)
set -euo pipefail

: "${SUPABASE_DB_URL:?missing SUPABASE_DB_URL}"
: "${R2_BACKUP_ACCOUNT_ID:?missing R2_BACKUP_ACCOUNT_ID}"
: "${R2_BACKUP_ACCESS_KEY:?missing R2_BACKUP_ACCESS_KEY}"
: "${R2_BACKUP_SECRET_KEY:?missing R2_BACKUP_SECRET_KEY}"
: "${R2_BACKUP_BUCKET:?missing R2_BACKUP_BUCKET}"

STAMP=$(date -u +'%Y-%m-%dT%H%MZ')
OUT="art-db-${STAMP}.sql.gz"

echo "[backup] pg_dump → ${OUT}"
pg_dump \
  --no-owner --no-privileges --clean --if-exists \
  --exclude-schema='pg_*' \
  --exclude-schema=information_schema \
  "$SUPABASE_DB_URL" \
  | gzip -9 > "$OUT"

SIZE=$(stat -c%s "$OUT")
echo "[backup] dump size: ${SIZE} bytes"
if [ "$SIZE" -lt 10000 ]; then
  echo "[backup] FAIL: dump suspiciously small (<10 KB) — aborting upload."
  exit 1
fi

# Trim any accidental whitespace pasted into secrets (e.g. trailing newline).
R2_BACKUP_ACCOUNT_ID=$(printf '%s' "$R2_BACKUP_ACCOUNT_ID" | tr -d '[:space:]')
R2_BACKUP_BUCKET=$(printf '%s'    "$R2_BACKUP_BUCKET"    | tr -d '[:space:]')
R2_BACKUP_ACCESS_KEY=$(printf '%s' "$R2_BACKUP_ACCESS_KEY" | tr -d '[:space:]')
R2_BACKUP_SECRET_KEY=$(printf '%s' "$R2_BACKUP_SECRET_KEY" | tr -d '[:space:]')

# Length diagnostics — R2 access key is 32 hex chars, secret is 64. Anything else
# means the GitHub secret value is wrong / has extra characters / is mistyped.
echo "[backup] account id length: ${#R2_BACKUP_ACCOUNT_ID} (expect 32)"
echo "[backup] access key length: ${#R2_BACKUP_ACCESS_KEY} (expect 32)"
echo "[backup] secret key length: ${#R2_BACKUP_SECRET_KEY} (expect 64)"
echo "[backup] bucket name:       ${R2_BACKUP_BUCKET}"

# Upload via boto3 — rclone's S3 signing produces malformed sigv4 credentials
# against R2 regardless of provider config. boto3 with region_name='auto' is the
# documented working path for Cloudflare R2.
pip install -q boto3

ENDPOINT="https://${R2_BACKUP_ACCOUNT_ID}.r2.cloudflarestorage.com"
KEY="daily/${OUT}"

echo "[backup] endpoint: ${R2_BACKUP_ACCOUNT_ID:0:4}….r2.cloudflarestorage.com"
echo "[backup] upload ${R2_BACKUP_BUCKET}/${KEY}"

R2_BACKUP_ACCOUNT_ID="$R2_BACKUP_ACCOUNT_ID" \
R2_BACKUP_ACCESS_KEY="$R2_BACKUP_ACCESS_KEY" \
R2_BACKUP_SECRET_KEY="$R2_BACKUP_SECRET_KEY" \
R2_BACKUP_BUCKET="$R2_BACKUP_BUCKET" \
BACKUP_ENDPOINT="$ENDPOINT" \
BACKUP_SRC="$OUT" \
BACKUP_KEY="$KEY" \
python3 - <<'PYEOF'
import boto3, os

s3 = boto3.client(
    's3',
    endpoint_url=os.environ['BACKUP_ENDPOINT'],
    aws_access_key_id=os.environ['R2_BACKUP_ACCESS_KEY'],
    aws_secret_access_key=os.environ['R2_BACKUP_SECRET_KEY'],
    region_name='auto',
)
bucket = os.environ['R2_BACKUP_BUCKET']
key    = os.environ['BACKUP_KEY']
src    = os.environ['BACKUP_SRC']
s3.upload_file(src, bucket, key)
print(f'[backup] done → {bucket}/{key}')
PYEOF

echo "[backup] done."
