#!/usr/bin/env bash
# Work rule checks (docs/WORK_RULES.md §2, §6) — runs supabase/sql/work_rules_checks.sql READ ONLY.
# Prints each breaking work ("rule | oeuvre_id | titre | detail"); exits 1 when any rule returns rows.
# Required env: SUPABASE_DB_URL (same secret as the nightly backup). Needs psql on PATH.
set -euo pipefail

: "${SUPABASE_DB_URL:?missing SUPABASE_DB_URL}"
cd "$(dirname "$0")/.."

OUT=$(
  {
    echo "begin;"
    echo "set transaction read only;"
    echo "set local statement_timeout = '120s';"
    cat supabase/sql/work_rules_checks.sql
    echo
    echo "rollback;"
  } | psql "$SUPABASE_DB_URL" -X -q -A -t -F ' | ' -v ON_ERROR_STOP=1 -f -
)

BREAKS=$(printf '%s\n' "$OUT" | sed '/^[[:space:]]*$/d')
if [ -n "$BREAKS" ]; then
  COUNT=$(printf '%s\n' "$BREAKS" | wc -l | tr -d ' ')
  echo "[work-rules] ${COUNT} break(s) — rule | work | title | detail:"
  printf '%s\n' "$BREAKS"
  echo "[work-rules] Breaking works: $(printf '%s\n' "$BREAKS" | awk -F ' [|] ' '{print "#"$2}' | sort -u | paste -sd ' ' -)"
  exit 1
fi
echo "[work-rules] all rules hold (0 breaks)"
