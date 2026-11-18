// Read-only catalog query against the PRODUCTION project via the Management API read-only endpoint.
// Usage: node q.mjs "<sql>"  (prints JSON). Never writes.
import fs from 'node:fs';
const env = fs.readFileSync(process.env.PEM_ENV_FILE ?? 'C:/Users/pppee/Documents/Claude/Projects/Art db/app/.env.local','utf8');
const tok = /^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(env)[1].trim().replace(/^"|"$/g,'');
export async function q(sql){
  const r = await fetch('https://api.supabase.com/v1/projects/mcrzsxrcoexnlwmaunte/database/query/read-only',{method:'POST',headers:{Authorization:`Bearer ${tok}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql})});
  const t = await r.text(); if(!r.ok) throw new Error(r.status+' '+t); return JSON.parse(t);
}
if (process.argv[1].endsWith('q.mjs') && process.argv[2]) console.log(JSON.stringify(await q(process.argv[2])));
