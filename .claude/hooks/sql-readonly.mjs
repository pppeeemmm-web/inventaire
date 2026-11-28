// PreToolUse hook (Pem 2026-11-27: « if read only, allow auto SQL »). Approves a Supabase `execute_sql` call without a
// prompt only when the query can be shown to only read; anything else prints nothing, so the normal permission prompt
// runs. Node, so it works on Windows and in Linux cloud sessions. When in doubt it does not approve.
let raw = ''
process.stdin.on('data', (c) => (raw += c))
process.stdin.on('end', () => {
  let q = ''
  try {
    q = String(JSON.parse(raw)?.tool_input?.query ?? '')
  } catch {
    q = ''
  }
  // Pem 2026-11-28: the claude.ai Supabase connector sets execute_sql to « Always allow » (its own « ask » overrode this
  // hook's allow), so anything not proven read-only must ask here, explicitly.
  const ok = readOnly(q)
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: ok ? 'allow' : 'ask',
      permissionDecisionReason: ok ? 'read-only SQL (sql-readonly hook)' : 'not provably read-only SQL: Pem decides (sql-readonly hook)',
    },
  }))
})

// Keywords that write, change the schema, lock, run code or reach the server's files: any one → ask.
const WRITE = /\b(insert|update|delete|merge|upsert|alter|create|drop|truncate|grant|revoke|comment|copy|call|do|vacuum|analy[sz]e|lock|set|reset|refresh|reindex|cluster|notify|listen|unlisten|execute|prepare|deallocate|import|into|security|owner|begin|commit|rollback|savepoint|release|discard|checkpoint|load)\b/i
// Words that may stand before « ( » without being a function call.
const NOT_CALL = new Set(['in', 'exists', 'any', 'all', 'some', 'filter', 'over', 'as', 'from', 'join', 'select', 'where', 'and', 'or', 'not',
  'values', 'on', 'using', 'by', 'when', 'then', 'else', 'case', 'with', 'lateral', 'is', 'between', 'like', 'ilike', 'within', 'group', 'union', 'intersect', 'except'])
// Built-in functions that only compute.
const READ_FN = new Set(['count', 'sum', 'min', 'max', 'avg', 'coalesce', 'nullif', 'greatest', 'least', 'cast', 'to_char', 'to_date', 'to_timestamp',
  'date_trunc', 'date_part', 'extract', 'now', 'age', 'left', 'right', 'length', 'char_length', 'lower', 'upper', 'trim', 'btrim', 'ltrim', 'rtrim',
  'substr', 'substring', 'position', 'strpos', 'replace', 'split_part', 'concat', 'concat_ws', 'format', 'string_agg', 'array_agg', 'array_length',
  'unnest', 'cardinality', 'round', 'floor', 'ceil', 'abs', 'row_number', 'rank', 'dense_rank', 'lag', 'lead', 'first_value', 'last_value',
  'jsonb_build_object', 'json_build_object', 'jsonb_agg', 'json_agg', 'jsonb_object_keys', 'jsonb_array_elements', 'jsonb_each', 'jsonb_typeof',
  'to_jsonb', 'to_json', 'row_to_json', 'pg_get_functiondef', 'pg_get_triggerdef', 'pg_get_viewdef', 'pg_get_constraintdef', 'pg_get_indexdef',
  'pg_typeof', 'pg_size_pretty', 'pg_total_relation_size', 'pg_relation_size', 'regexp_replace', 'regexp_match', 'regexp_matches', 'md5',
  'generate_series', 'make_date', 'date', 'interval', 'quote_ident', 'quote_literal', 'string_to_array', 'array_to_string', 'bool_or', 'bool_and',
  'percentile_cont', 'percentile_disc', 'mode', 'initcap', 'reverse', 'repeat', 'lpad', 'rpad', 'trunc', 'mod', 'power', 'sqrt', 'random',
  'current_setting', 'has_table_privilege', 'has_function_privilege', 'obj_description', 'col_description', 'format_type', 'array_position',
  'to_number', 'timezone', 'justify_interval', 'isfinite',
  // Catalog and JSON reads used when checking the live schema (Pem 2026-11-28: « SQL reading asking me again and again »).
  'pg_get_expr', 'pg_get_userbyid', 'pg_get_function_arguments', 'pg_get_function_result', 'pg_get_function_identity_arguments',
  'pg_get_serial_sequence', 'pg_get_keywords', 'pg_table_is_visible', 'pg_function_is_visible', 'to_regclass', 'to_regproc',
  'to_regprocedure', 'to_regtype', 'format_type', 'pg_column_size', 'pg_indexes_size', 'pg_table_size', 'pg_database_size',
  'jsonb_array_length', 'json_array_length', 'jsonb_pretty', 'jsonb_extract_path', 'jsonb_extract_path_text', 'jsonb_strip_nulls',
  'jsonb_object_agg', 'json_object_agg', 'jsonb_build_array', 'json_build_array', 'jsonb_each_text', 'jsonb_array_elements_text',
  'jsonb_path_query', 'jsonb_path_exists', 'array_remove', 'array_cat', 'array_append', 'array_prepend', 'regexp_split_to_table',
  'regexp_split_to_array', 'regexp_count', 'octet_length', 'bit_length', 'encode', 'sha256', 'translate', 'starts_with',
  'unaccent', 'date_bin', 'make_timestamp', 'make_interval', 'to_regnamespace', 'version', 'current_database', 'current_schema'])
// Read-only by name: catalog getters, privilege checks, descriptions.
const READ_FN_RE = /^(pg_get_\w+|has_\w+_privilege|\w+_description)$/

export function readOnly(sql) {
  // One left-to-right pass: strings, quoted identifiers, dollar-quoted bodies and comments, whichever starts first,
  // so a « -- » inside a string cannot hide what follows. Words inside them do not count.
  let s = sql
    .replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|\$([A-Za-z_]*)\$[\s\S]*?\$\1\$|--[^\n]*|\/\*[\s\S]*?\*\//g, (m) =>
      m[0] === '"' ? ' ident ' : m[0] === "'" || m[0] === '$' ? " '' " : ' ')
    .trim()
  if (/['"]|\$\$|\/\*/.test(s.replace(/''/g, ''))) return false // an unclosed quote or comment: not provable
  s = s.replace(/;\s*$/, '')
  if (!s || s.includes(';')) return false // one statement only
  if (!/^(select|with|explain|values|table|show)\b/i.test(s)) return false
  if (/^explain\b/i.test(s) && /\banaly[sz]e\b/i.test(s)) return false // EXPLAIN ANALYZE runs the statement
  if (WRITE.test(s)) return false
  for (const m of s.matchAll(/([A-Za-z_][A-Za-z0-9_.]*)\s*\(/g)) {
    const name = m[1].toLowerCase().split('.').pop()
    if (NOT_CALL.has(name) || READ_FN.has(name) || READ_FN_RE.test(name)) continue
    return false // a function that is not known to only read
  }
  return true
}
