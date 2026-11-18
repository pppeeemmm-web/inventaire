#!/usr/bin/env bash
# Work rule checks (docs/WORK_RULES.md §2, §6) — runs supabase/sql/work_rules_checks.sql READ ONLY,
# then writes one summary row to work_rule_run (Overview « Système », Pem 2026-11-18).
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
# One summary row for the Overview « Système » signal (supabase/sql/work_rule_runs.sql) — the only
# write of this job; the works are only read. Skipped with a warning while the table does not exist.
record_run() {
  psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1 \
    -c "insert into public.work_rule_run (source, breaks, by_rule) values ('nightly', $1, '$2'::jsonb)" \
    >/dev/null 2>&1 || echo "[work-rules] summary row not written (work_rule_run missing?)"
}
if [ -n "$BREAKS" ]; then
  BY_RULE=$(printf '%s\n' "$BREAKS" | awk -F ' [|] ' '{c[$1]++} END {s=""; for (r in c) {s = s (s=="" ? "" : ",") "\"" r "\":" c[r]}; print "{" s "}"}')
  record_run "$(printf '%s\n' "$BREAKS" | wc -l | tr -d ' ')" "$BY_RULE"
  COUNT=$(printf '%s\n' "$BREAKS" | wc -l | tr -d ' ')
  echo "[work-rules] ${COUNT} break(s) — rule | work | title | detail:"
  printf '%s\n' "$BREAKS"
  echo "[work-rules] Breaking works: $(printf '%s\n' "$BREAKS" | awk -F ' [|] ' '{print "#"$2}' | sort -u | paste -sd ' ' -)"
  exit 1
fi
record_run 0 '{}'
echo "[work-rules] all rules hold (0 breaks)"
