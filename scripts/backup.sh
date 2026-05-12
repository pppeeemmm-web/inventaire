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
R2_BACKUP_BUCKET=$(printf '%s' "$R2_BACKUP_BUCKET" | tr -d '[:space:]')

# Upload via awscli with R2 S3-compatible endpoint.
# Bucket lives in EU jurisdiction → endpoint must include `.eu.` subdomain.
# Override with R2_BACKUP_JURISDICTION='' if you ever move to a global bucket.
export AWS_ACCESS_KEY_ID="$R2_BACKUP_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$R2_BACKUP_SECRET_KEY"
export AWS_DEFAULT_REGION="auto"

JURI="${R2_BACKUP_JURISDICTION-eu}"
JSUB=""
[ -n "$JURI" ] && JSUB=".${JURI}"
ENDPOINT="https://${R2_BACKUP_ACCOUNT_ID}${JSUB}.r2.cloudflarestorage.com"
KEY="daily/${OUT}"

echo "[backup] endpoint host: ${R2_BACKUP_ACCOUNT_ID:0:4}…${JSUB}.r2.cloudflarestorage.com"
echo "[backup] upload s3://${R2_BACKUP_BUCKET}/${KEY}"
aws s3 cp "$OUT" "s3://${R2_BACKUP_BUCKET}/${KEY}" --endpoint-url "$ENDPOINT"

echo "[backup] done."
