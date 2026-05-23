#!/usr/bin/env bash
# Slice 7 Phase 2 — export entity + edge_fact views to CSV and upload to R2 backup bucket.
# Column order matches lib/export/graph-csv-views.ts (admin /api/export/csv).
#
# Required env (same secrets as scripts/backup.sh):
#   SUPABASE_DB_URL, R2_BACKUP_ACCOUNT_ID, R2_BACKUP_ACCESS_KEY,
#   R2_BACKUP_SECRET_KEY, R2_BACKUP_BUCKET
set -euo pipefail

: "${SUPABASE_DB_URL:?missing SUPABASE_DB_URL}"
: "${R2_BACKUP_ACCOUNT_ID:?missing R2_BACKUP_ACCOUNT_ID}"
: "${R2_BACKUP_ACCESS_KEY:?missing R2_BACKUP_ACCESS_KEY}"
: "${R2_BACKUP_SECRET_KEY:?missing R2_BACKUP_SECRET_KEY}"
: "${R2_BACKUP_BUCKET:?missing R2_BACKUP_BUCKET}"

TS=$(date -u +'%Y-%m-%d')
ENTITY_OUT="pem_entity_${TS}.csv"
EDGE_OUT="pem_edge_fact_${TS}.csv"

ENTITY_SQL="COPY (
  SELECT node_id, node_type, source_pk, created_at, display_label, title, is_public, legacy_int_id, legacy_uuid
  FROM public.entity
  ORDER BY node_type, node_id
) TO STDOUT WITH (FORMAT CSV, HEADER true)"

EDGE_SQL="COPY (
  SELECT edge_id, relation_type, strength, description, edge_created_at,
    legacy_source_oeuvre_id, legacy_target_oeuvre_id,
    source_node_id, target_node_id, source_node_type, source_pk, source_label,
    source_legacy_int_id, source_legacy_uuid,
    target_node_type, target_pk, target_label, target_legacy_int_id, target_legacy_uuid
  FROM public.edge_fact
  ORDER BY edge_id
) TO STDOUT WITH (FORMAT CSV, HEADER true)"

export_csv() {
  local label="$1"
  local out="$2"
  local sql="$3"
  local tmp
  tmp=$(mktemp)
  echo "[graph-csv] ${label} → ${out}"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "$sql" >"$tmp"
  # UTF-8 BOM — Excel / LibreOffice (matches lib/export/csv.ts)
  printf '\xEF\xBB\xBF' >"$out"
  cat "$tmp" >>"$out"
  rm -f "$tmp"
  local size
  size=$(stat -c%s "$out" 2>/dev/null || stat -f%z "$out")
  echo "[graph-csv] ${out} size: ${size} bytes"
  if [ "$size" -lt 50 ]; then
    echo "[graph-csv] FAIL: ${out} suspiciously small — aborting."
    exit 1
  fi
}

export_csv entity "$ENTITY_OUT" "$ENTITY_SQL"
export_csv edge_fact "$EDGE_OUT" "$EDGE_SQL"

R2_BACKUP_ACCOUNT_ID=$(printf '%s' "$R2_BACKUP_ACCOUNT_ID" | tr -d '[:space:]')
R2_BACKUP_BUCKET=$(printf '%s'    "$R2_BACKUP_BUCKET"    | tr -d '[:space:]')
R2_BACKUP_ACCESS_KEY=$(printf '%s' "$R2_BACKUP_ACCESS_KEY" | tr -d '[:space:]')
R2_BACKUP_SECRET_KEY=$(printf '%s' "$R2_BACKUP_SECRET_KEY" | tr -d '[:space:]')

pip install -q boto3

ENDPOINT="https://${R2_BACKUP_ACCOUNT_ID}.eu.r2.cloudflarestorage.com"

upload_one() {
  local src="$1"
  local key="weekly/${src}"
  echo "[graph-csv] upload ${R2_BACKUP_BUCKET}/${key}"
  R2_BACKUP_ACCOUNT_ID="$R2_BACKUP_ACCOUNT_ID" \
  R2_BACKUP_ACCESS_KEY="$R2_BACKUP_ACCESS_KEY" \
  R2_BACKUP_SECRET_KEY="$R2_BACKUP_SECRET_KEY" \
  R2_BACKUP_BUCKET="$R2_BACKUP_BUCKET" \
  BACKUP_ENDPOINT="$ENDPOINT" \
  BACKUP_SRC="$src" \
  BACKUP_KEY="$key" \
  python3 - <<'PYEOF'
import boto3, os

s3 = boto3.client(
    's3',
    endpoint_url=os.environ['BACKUP_ENDPOINT'],
    aws_access_key_id=os.environ['R2_BACKUP_ACCESS_KEY'],
    aws_secret_access_key=os.environ['R2_BACKUP_SECRET_KEY'],
    region_name='auto',
)
s3.upload_file(
    os.environ['BACKUP_SRC'],
    os.environ['R2_BACKUP_BUCKET'],
    os.environ['BACKUP_KEY'],
    ExtraArgs={'ContentType': 'text/csv; charset=utf-8'},
)
print(f"[graph-csv] done → {os.environ['R2_BACKUP_BUCKET']}/{os.environ['BACKUP_KEY']}")
PYEOF
}

upload_one "$ENTITY_OUT"
upload_one "$EDGE_OUT"

echo "[graph-csv] all uploads complete."
