// Copy the lookup tables (labels only, no personal data) from production, read-only. Writes dump/lookups.sql.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { q } from './q.mjs';
const T = ['OeuvreStatus','Format','Support','Technique','tblRole','tblPresentation','work_action_type'];
const out = ['-- lookup tables from production (labels only)'];
for (const t of T) {
  const rows = await q(`select * from public."${t}"`);
  if (!rows.length) continue;
  const cols = Object.keys(rows[0]);
  const lit = (v) => v === null ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
  out.push(`insert into public."${t}" (${cols.map(c=>`"${c}"`).join(',')}) overriding system value values\n${rows.map(r=>`(${cols.map(c=>lit(r[c])).join(',')})`).join(',\n')};`);
  // keep serial/identity counters after the copied ids
  out.push(`select setval(pg_get_serial_sequence('public."${t}"','${cols[0]}'), (select max("${cols[0]}") from public."${t}")) where pg_get_serial_sequence('public."${t}"','${cols[0]}') is not null;`);
}
fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'dump','lookups.sql'), out.join('\n\n')+'\n');
console.log('ok', T.length);
