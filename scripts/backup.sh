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

# Install latest rclone from rclone.org. Ubuntu's apt ships 1.60 (2022) whose
# R2 provider profile is too old; the upstream installer gives us a current build.
curl -fsSL https://rclone.org/install.sh | sudo bash >/dev/null
rclone version | head -1

# Upload via rclone — AWS CLI v2's recent SigV4 additions break against R2.
# rclone has a dedicated Cloudflare R2 provider profile and a stable upload path.
# Use the global R2 endpoint (no .eu. subdomain) + path-style addressing.
# Virtual-hosted-style on the EU jurisdiction subdomain returns bare BadRequest 400.
ENDPOINT="https://${R2_BACKUP_ACCOUNT_ID}.r2.cloudflarestorage.com"
KEY="daily/${OUT}"

echo "[backup] endpoint host: ${R2_BACKUP_ACCOUNT_ID:0:4}….r2.cloudflarestorage.com"
echo "[backup] upload :s3:${R2_BACKUP_BUCKET}/${KEY}"
rclone \
  --s3-provider=Cloudflare \
  --s3-access-key-id="${R2_BACKUP_ACCESS_KEY}" \
  --s3-secret-access-key="${R2_BACKUP_SECRET_KEY}" \
  --s3-endpoint="${ENDPOINT}" \
  --s3-region=auto \
  --s3-acl=private \
  --s3-no-check-bucket \
  --no-check-dest \
  --ignore-checksum \
  copyto "$OUT" ":s3:${R2_BACKUP_BUCKET}/${KEY}"

echo "[backup] done."
