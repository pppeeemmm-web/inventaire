/**
 * Archive export — the oeuvre readable without this app, and the image backup (owner 2026-11-13).
 *
 *   npm run archive                      -> %USERPROFILE%\PEM-Archive
 *   npm run archive -- --out "E:\PEM"    -> another folder / disk
 *
 * One run = a complete copy, safe to repeat (only new or changed files are downloaded):
 *   index.html          open it in a browser: every work, searchable, with its journal entries
 *   works.csv           one line per work, labels spelled out (opens in Excel / LibreOffice)
 *   journal/YYYY.md     journal entries as plain text, by year
 *   images/             every image, named as in the catalogue (+ thumbs/)
 *   vault/              documents (certificates, orders…)
 *   data/json/*.json    every table, complete
 *   private/            contacts — NOT for sharing
 *   LISEZ-MOI.txt       what is what
 *
 * Reads only: nothing is changed in the database or in R2. Prices, notes and contacts are in the
 * archive: keep the folder private.
 */
import { config as loadDotenv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { createWriteStream } from 'node:fs'
import { mkdir, stat, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

loadDotenv({ path: '.env.local', override: false, quiet: true })

const env = (name) => {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Missing ${name} in .env.local`)
  return v
}
const argOut = process.argv.indexOf('--out')
const OUT = path.resolve(argOut > -1 ? process.argv[argOut + 1] : path.join(os.homedir(), 'PEM-Archive'))
const SKIP_PREFIX = ['recycle/', 'share-inbox/', 'ledger/']

const sb = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env('R2_ACCOUNT_ID')}.eu.r2.cloudflarestorage.com`, // EU endpoint only
  credentials: { accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY') },
})

/** Every row of a table (PostgREST pages of 1000). */
async function all(table, order) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select('*').range(from, from + 999)
    if (order) q = q.order(order, { ascending: true })
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

async function writeText(rel, text) {
  const file = path.join(OUT, rel)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, text, 'utf8')
}

const csvCell = (v) => {
  if (v == null) return ''
  const s = String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
// ";" separator + BOM: opens correctly in a French Excel.
const toCsv = (rows, cols) => '\uFEFF' + [cols.join(';'), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(';'))].join('\r\n')

/** Mirror a bucket into a folder; skip files already there with the same size. */
async function mirrorBucket(bucket, relDir) {
  let token
  let seen = 0, fetched = 0, bytes = 0
  const failed = []
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }))
    for (const obj of page.Contents ?? []) {
      if (!obj.Key || obj.Key.endsWith('/') || SKIP_PREFIX.some((p) => obj.Key.startsWith(p))) continue
      seen++
      bytes += obj.Size ?? 0
      const dest = path.join(OUT, relDir, ...obj.Key.split('/'))
      const have = await stat(dest).catch(() => null)
      if (have && have.size === obj.Size) continue
      try {
        await mkdir(path.dirname(dest), { recursive: true })
        const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: obj.Key }))
        await pipeline(res.Body, createWriteStream(dest))
        if (obj.LastModified) await utimes(dest, obj.LastModified, obj.LastModified)
        fetched++
        if (fetched % 100 === 0) console.log(`  ${relDir}: ${fetched} downloaded…`)
      } catch (err) {
        failed.push(`${obj.Key}: ${err.message}`)
      }
    }
    token = page.NextContinuationToken
  } while (token)
  return { seen, fetched, bytes, failed }
}

const year = (d) => (d ? Number(String(d).slice(0, 4)) : null)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

async function main() {
  const started = new Date()
  console.log(`Archive -> ${OUT}`)
  await mkdir(OUT, { recursive: true })

  // ── Data ────────────────────────────────────────────────────────────────────────────────────
  const tables = {
    Oeuvres: 'OeuvreID', tblImage: 'ImageID', Technique: 'TechniqueID', Support: 'SupportID', Format: null,
    OeuvreStatus: 'id', theme: 'id', oeuvre_theme: 'oeuvre_id', work_period: 'id', work_period_override: 'oeuvre_id',
    work_source: 'id', work_source_link: 'oeuvre_id', working_group: null, working_group_work: null,
    tblrelations: null, journal_entry: 'id', journal_entry_link: 'id', concept: null, voice_note: 'created_at',
    condition_report: 'id', condition_issue: 'id', kaizen_item: 'id', document: 'created_at', work_session: 'created_at',
    sale_order: 'created_at', suivi_process: null, suivi_etape: null, expense: null, stock_item: null,
  }
  const privateTables = { Contact: 'ContactID', contact_addresses: null, contact_emails: null, contact_phones: null }
  const db = {}
  for (const [t, order] of Object.entries({ ...tables, ...privateTables })) {
    db[t] = await all(t, order)
    const dir = t in privateTables ? 'private' : 'data/json'
    await writeText(`${dir}/${t}.json`, JSON.stringify(db[t], null, 1))
  }
  console.log(`  data: ${Object.keys(db).length} tables, ${Object.values(db).reduce((n, r) => n + r.length, 0)} rows`)

  const label = (rows, idCol, nameCol) => new Map(rows.map((r) => [r[idCol], r[nameCol]]))
  const tech = label(db.Technique, 'TechniqueID', 'Technique')
  const sup = label(db.Support, 'SupportID', 'Support')
  const status = label(db.OeuvreStatus, 'id', 'label')
  const themeName = label(db.theme, 'id', 'name')
  const sourceName = label(db.work_source, 'id', 'name')
  const contactName = new Map(db.Contact.map((c) => [c.ContactID, c.NomInstitution || [c['Prénom'], c.Nom].filter(Boolean).join(' ')]))
  const group = (rows, key) => rows.reduce((m, r) => (m.set(r[key], [...(m.get(r[key]) ?? []), r]), m), new Map())
  const themesBy = group(db.oeuvre_theme, 'oeuvre_id')
  const sourcesBy = group(db.work_source_link, 'oeuvre_id')
  const imagesBy = group(db.tblImage, 'OeuvreID')
  const override = new Map(db.work_period_override.map((o) => [o.oeuvre_id, o.period_id]))
  const periodById = label(db.work_period, 'id', 'name')
  const periodOf = (w) => {
    if (override.has(w.OeuvreID)) return periodById.get(override.get(w.OeuvreID)) ?? ''
    const y = year(w['Année']) ?? year(w.production_started_on)
    if (y == null) return ''
    const hit = db.work_period
      .filter((p) => p.start_year <= y && (p.end_year == null || p.end_year >= y))
      .sort((a, b) => b.start_year - a.start_year || (a.end_year ?? 9999) - a.start_year - ((b.end_year ?? 9999) - b.start_year))[0]
    return hit?.name ?? ''
  }

  const works = db.Oeuvres.filter((w) => !w.deleted_at).map((w) => ({
    number: w.OeuvreID,
    title: w.Titre ?? '',
    year: year(w['Année']) ?? '',
    technique: tech.get(w.Technique) ?? '',
    support: sup.get(w.Support) ?? '',
    height_cm: w.Hauteur ?? '',
    width_cm: w.Largeur ?? '',
    depth_cm: w.Profondeur ?? '',
    status: status.get(w.statusId) ?? '',
    fate: w.fate ?? '',
    period: periodOf(w),
    themes: (themesBy.get(w.OeuvreID) ?? []).map((t) => themeName.get(t.theme_id)).filter(Boolean).join(', '),
    sources: (sourcesBy.get(w.OeuvreID) ?? []).map((s) => [sourceName.get(s.source_id), s.note].filter(Boolean).join(' — ')).join(', '),
    production_start: w.production_started_on ?? '',
    production_end: w.production_completed_on ?? '',
    owner: contactName.get(w.ContactID) ?? '',
    held_by: contactName.get(w.LocalisationID) ?? '',
    price: w.Prix ?? '',
    comments: w.Commentaires ?? '',
    history: w.Historique ?? '',
    cover: w.txtImageNameLink ?? '',
    images: (imagesBy.get(w.OeuvreID) ?? []).sort((a, b) => (a.SeqNo ?? 0) - (b.SeqNo ?? 0)).map((i) => i.txtImageNameLink).filter(Boolean).join(' | '),
  }))
  await writeText('works.csv', toCsv(works, Object.keys(works[0] ?? { number: 0 })))

  // ── Journal as text ─────────────────────────────────────────────────────────────────────────
  const linksBy = group(db.journal_entry_link.filter((l) => !l.rejected_at && (l.proposed_by !== 'ai' || l.validated_at)), 'entry_id')
  const conceptName = label(db.concept, 'id', 'titre')
  const entries = db.journal_entry.filter((e) => !e.hidden_at).sort((a, b) => String(a.event_on).localeCompare(String(b.event_on)) || a.id - b.id)
  const byYear = group(entries.map((e) => ({ ...e, y: year(e.event_on) })), 'y')
  for (const [y, list] of byYear) {
    const text = list.map((e) => {
      const links = (linksBy.get(e.id) ?? []).map((l) => (l.oeuvre_id ? `#${l.oeuvre_id}` : conceptName.get(l.concept_id))).filter(Boolean)
      const meta = [e.kind, e.provenance, e.verification === 'unverified' ? 'unverified' : null, e.engine ? `machine transcript: ${e.engine}` : null, e.visibility === 'private' ? 'private' : null].filter(Boolean).join(' · ')
      return `## ${e.event_on} — entry ${e.id}\n_${meta}_${links.length ? `\nLinked: ${links.join(', ')}` : ''}\n\n${e.body}\n`
    }).join('\n---\n\n')
    await writeText(`journal/${y}.md`, `# Journal ${y}\n\n${text}`)
  }

  // ── Offline browser page ────────────────────────────────────────────────────────────────────
  const entriesByWork = new Map()
  for (const e of entries) for (const l of linksBy.get(e.id) ?? []) if (l.oeuvre_id) entriesByWork.set(l.oeuvre_id, [...(entriesByWork.get(l.oeuvre_id) ?? []), { on: e.event_on, body: e.body }])
  const pageData = works.map((w) => ({ ...w, price: undefined, owner: undefined, held_by: undefined, journal: entriesByWork.get(w.number) ?? [] }))
  await writeText('data/works.js', `window.WORKS=${JSON.stringify(pageData)};`)
  await writeText('index.html', `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pierre Emmanuel Moulin — archive</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#f6f4ef;color:#222}
header{position:sticky;top:0;background:#f6f4ef;padding:12px 16px;border-bottom:1px solid #ccc;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
input{font:inherit;padding:8px 10px;min-width:260px;flex:1;max-width:520px;border:1px solid #999;border-radius:4px}
#grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;padding:16px}
.c{background:#fff;border:1px solid #ddd;cursor:pointer;padding:6px;font-size:12px}
.c img{width:100%;aspect-ratio:1;object-fit:contain;background:#eee;display:block}
dialog{max-width:900px;width:92vw;border:1px solid #888;padding:20px}
dialog img{max-width:100%;max-height:70vh;display:block;margin:0 auto 12px}
dl{display:grid;grid-template-columns:140px 1fr;gap:4px 12px}dt{color:#666}dd{margin:0;white-space:pre-wrap}
blockquote{margin:8px 0;padding:8px 12px;background:#f6f4ef;border-left:3px solid #999;white-space:pre-wrap}
button{font:inherit;padding:6px 12px}
</style>
<header><strong>Pierre Emmanuel Moulin — archive</strong><input id="q" placeholder="Rechercher / search: title, year, technique, theme, #number"><span id="n"></span><span>${esc(started.toISOString().slice(0, 10))}</span></header>
<div id="grid"></div><dialog id="d"></dialog>
<script src="data/works.js"></script>
<script>
const thumb=f=>f?'images/thumbs/'+f.replace(/\\.[^.]+$/,'')+'.avif':'';
const h=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const grid=document.getElementById('grid'),d=document.getElementById('d'),q=document.getElementById('q');
function show(){const t=q.value.toLowerCase().trim().split(/\\s+/).filter(Boolean);
 const list=WORKS.filter(w=>{const s=('#'+w.number+' '+w.title+' '+w.year+' '+w.technique+' '+w.support+' '+w.themes+' '+w.period+' '+w.sources+' '+w.status).toLowerCase();return t.every(x=>s.includes(x))}).sort((a,b)=>b.number-a.number);
 document.getElementById('n').textContent=list.length+' / '+WORKS.length;
 grid.innerHTML=list.slice(0,600).map(w=>'<div class=c data-n='+w.number+'><img loading=lazy src="'+h(thumb(w.cover))+'" alt=""><b>#'+w.number+'</b> '+h(w.title)+' '+h(w.year)+'</div>').join('')}
grid.onclick=e=>{const c=e.target.closest('.c');if(!c)return;const w=WORKS.find(x=>x.number==c.dataset.n);
 const rows=[['Titre / title',w.title],['Année / year',w.year],['Technique',w.technique],['Support',w.support],['Dimensions (cm)',[w.height_cm,w.width_cm,w.depth_cm].filter(x=>x!=='').join(' × ')],['Statut / status',w.status+(w.fate?' · '+w.fate:'')],['Période / period',w.period],['Thèmes / themes',w.themes],['Source',w.sources],['Production',[w.production_start,w.production_end].filter(Boolean).join(' → ')],['Commentaires',w.comments],['Historique',w.history]].filter(r=>r[1]!==''&&r[1]!=null);
 d.innerHTML='<form method=dialog><button>Fermer / close</button></form><h2>#'+w.number+' '+h(w.title)+'</h2>'+w.images.split(' | ').filter(Boolean).map(f=>'<img src="images/'+h(f)+'" alt="">').join('')+'<dl>'+rows.map(r=>'<dt>'+r[0]+'</dt><dd>'+h(r[1])+'</dd>').join('')+'</dl>'+(w.journal.length?'<h3>Journal</h3>'+w.journal.map(j=>'<blockquote><b>'+j.on+'</b>\\n'+h(j.body)+'</blockquote>').join(''):'');d.showModal()};
q.oninput=show;show();
</script></html>`)

  // ── Files ───────────────────────────────────────────────────────────────────────────────────
  console.log('  images…')
  const img = await mirrorBucket(env('R2_BUCKET'), 'images')
  const vaultBucket = process.env.R2_VAULT_BUCKET?.trim()
  const vault = vaultBucket ? await mirrorBucket(vaultBucket, 'vault') : { seen: 0, fetched: 0, bytes: 0, failed: [] }

  const info = {
    made_at: started.toISOString(),
    works: works.length,
    journal_entries: entries.length,
    images: { files: img.seen, downloaded_this_run: img.fetched, gigabytes: +(img.bytes / 1e9).toFixed(2) },
    vault: { files: vault.seen, downloaded_this_run: vault.fetched },
    failed: [...img.failed, ...vault.failed],
  }
  await writeText('archive-info.json', JSON.stringify(info, null, 2))
  await writeText('LISEZ-MOI.txt', [
    `Archive de l'œuvre de Pierre Emmanuel Moulin — ${started.toISOString().slice(0, 10)}`,
    '',
    'index.html      ouvrir dans un navigateur : toutes les œuvres, recherche, journal lié',
    'works.csv       une ligne par œuvre (Excel / LibreOffice)',
    'journal/        le journal en texte, par année',
    'images/         toutes les images (format AVIF) ; images/thumbs = vignettes',
    'vault/          documents (certificats, commandes…)',
    'data/json/      toutes les tables, complètes',
    'private/        contacts — NE PAS DIFFUSER',
    '',
    'Archive of the work of Pierre Emmanuel Moulin. Open index.html in a browser. Prices, notes and',
    'contacts are inside: keep this folder private unless you remove works.csv, data/ and private/.',
    'AVIF images open in any current browser.',
  ].join('\r\n'))

  console.log(`Done: ${works.length} works · ${entries.length} journal entries · ${img.seen} image files (${info.images.gigabytes} GB, ${img.fetched} new) · ${vault.seen} documents (${vault.fetched} new)`)
  if (info.failed.length) {
    console.log(`FAILED downloads: ${info.failed.length}`)
    info.failed.slice(0, 10).forEach((f) => console.log('  ' + f))
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('Archive failed:', err.message)
  process.exit(1)
})
