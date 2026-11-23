// Stress-test seed — LOCAL Supabase only (scripts/stress/supabase, `supabase start --workdir scripts/stress`).
// Wipes and refills every public table except the lookups with FAKE data:
//   Pem (contact 13, admin) + a team member, ~45 fake contacts (collectors, galleries, institutions,
//   suppliers, a framer, a carrier), 1 200 works with placeholder AVIF images in the local R2 stub,
//   themes, groups, exhibitions + pipeline processes, supplies, and past sales / deposits / loans
//   (« reconstituted » orders, so works can be Vendu / Consigné / Prêt as the DB rules require).
// Usage: node scripts/stress/seed.mjs [--works 1200] [--no-images]
// Refuses to run unless the API is on 127.0.0.1 / localhost.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const N_WORKS = Number(args[args.indexOf('--works') + 1] || 0) || 1200;
const IMAGES = !args.includes('--no-images');

// ── local stack only ───────────────────────────────────────────────────────────────────────
export function localEnv() {
  // CLI v3 through npx, not an older global one: config.toml uses v3 keys ([local_smtp]).
  const txt = execSync(`npx -y supabase@3 status --workdir "${here}" -o env`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const env = Object.fromEntries(txt.split(/\r?\n/).filter((l) => l.includes('=')).map((l) => {
    const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
  }));
  const host = new URL(env.API_URL).hostname;
  if (!['127.0.0.1', 'localhost'].includes(host)) throw new Error(`Refusing: API_URL ${env.API_URL} is not local`);
  if (/mcrzsxrcoexnlwmaunte/.test(JSON.stringify(env))) throw new Error('Refusing: production project ref in env');
  return env;
}
export function psql(sql, { quiet = true } = {}) {
  const r = spawnSync('docker', ['exec', '-i', 'supabase_db_stress', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', ...(quiet ? ['-q'] : []), '-tA'],
    { input: sql, encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
  if (r.status !== 0) throw new Error(`psql failed: ${r.stderr}`);
  return r.stdout.trim();
}

// ── deterministic fake data ────────────────────────────────────────────────────────────────
let s = 20261118;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const lit = (v) => (v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const row = (vals) => `(${vals.map(lit).join(',')})`;

export const USERS = {
  admin: { email: 'pem.stress@example.test', password: 'stress-admin-2026', contact: 13 },
  team: { email: 'team.stress@example.test', password: 'stress-team-2026', contact: 14 },
  outsider: { email: 'outsider.stress@example.test', password: 'stress-out-2026', contact: null },
};

async function main() {
  const env = localEnv();
  const t0 = Date.now();
  const log = (m) => console.log(`[seed +${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

  // 1. wipe
  const tables = psql(`select string_agg(format('public.%I', relname), ', ') from pg_class where relnamespace='public'::regnamespace and relkind='r'
    and relname not in ('OeuvreStatus','Format','Support','Technique','tblRole','tblPresentation','work_action_type')`);
  psql(`truncate ${tables} restart identity cascade; delete from auth.users where email like '%@example.test';`);
  log('wiped');

  // 2. auth users (GoTrue admin API)
  const uid = {};
  for (const [k, u] of Object.entries(USERS)) {
    const r = await fetch(`${env.API_URL}/auth/v1/admin/users`, {
      method: 'POST', headers: { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: u.password, email_confirm: true, user_metadata: { full_name: `${k} (stress)` } }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`auth user ${k}: ${JSON.stringify(j)}`);
    uid[k] = j.id;
  }
  log('auth users');

  const sql = ['begin;'];
  // 3. contacts: Pem (13), team (14), then fakes from 100
  const C = [];
  C.push([13, null, 'Pem', 'Stress', 'Artiste', USERS.admin.email, 'Paris', 'France', true, uid.admin, true, true]);
  C.push([14, null, 'Membre', 'Équipe', 'Autre', USERS.team.email, 'Paris', 'France', true, uid.team, true, false]);
  C.push([15, null, 'Extérieur', 'Compte', 'Autre', USERS.outsider.email, 'Lyon', 'France', true, uid.outsider, false, false]);
  const groups = { collector: [], gallery: [], institution: [], supplier: [], framer: [], carrier: [] };
  let id = 100;
  const cities = [['Paris', 'France', '75003'], ['Lyon', 'France', '69002'], ['Bruxelles', 'Belgique', '1000'], ['Genève', 'Suisse', '1204'], ['Marseille', 'France', '13001'], ['Berlin', 'Allemagne', '10115']];
  for (let i = 1; i <= 25; i++) { groups.collector.push(id); C.push([id++, null, `Collector${String(i).padStart(2, '0')}`, pick(['Alex', 'Camille', 'Sam', 'Noa', 'Lou']), 'Autre', `collector${i}@example.test`, ...pick(cities).slice(0, 2), true, null, false, false]); }
  for (let i = 1; i <= 6; i++) { groups.gallery.push(id); C.push([id++, `Galerie Test ${'ABCDEF'[i - 1]}`, null, null, 'Autre', `galerie${i}@example.test`, ...pick(cities).slice(0, 2), true, null, false, false]); }
  for (let i = 1; i <= 2; i++) { groups.institution.push(id); C.push([id++, `Musée Test ${i}`, null, null, 'Autre', `musee${i}@example.test`, 'Paris', 'France', true, null, false, false]); }
  for (let i = 1; i <= 3; i++) { groups.supplier.push(id); C.push([id++, `Fournisseur Test ${i}`, null, null, 'Fournisseur', `fourn${i}@example.test`, 'Paris', 'France', true, null, false, false]); }
  groups.framer.push(id); C.push([id++, 'Encadreur Test', null, null, 'Fournisseur', 'cadre@example.test', 'Paris', 'France', true, null, false, false]);
  groups.carrier.push(id); C.push([id++, 'Transport Test', null, null, 'Fournisseur', 'transport@example.test', 'Paris', 'France', true, null, false, false]);
  sql.push(`insert into public."Contact" ("ContactID","NomInstitution","Nom","Prénom","Type","Email","Ville","Pays","Actif",auth_user_id,is_team_member,is_admin) values\n${C.map(row).join(',\n')};`);
  sql.push(`select setval('contact_id_seq', 1000);`);

  // addresses: Pem's two stage addresses (labels the location trigger looks for), one per contact,
  // two for three galleries and one collector (to exercise the address picker)
  const A = [[13, 'Atelier', '1 rue Test', '75011', 'Paris', 'France', 0], [13, 'Principal', '2 rue Test', '75011', 'Paris', 'France', 1]];
  for (const c of C.slice(3)) { const [v, p, z] = pick(cities); A.push([c[0], 'Principal', `${int(1, 90)} rue Fictive`, z, v, p, 0]); }
  for (const g of [...groups.gallery.slice(0, 3), groups.collector[0]]) A.push([g, 'Réserve', '9 quai Test', '93400', 'Saint-Ouen', 'France', 1]);
  // Places phase B: contact_addresses is read-only and the cards read places. The rows are written with its guard off,
  // then turned into places + links by the same backfill as live (nothing changes on a copy before phase B).
  sql.push(`do $$ begin if exists (select 1 from pg_trigger where tgname = 'trg_contact_addresses_read_only') then alter table public.contact_addresses disable trigger trg_contact_addresses_read_only; end if; end $$;`);
  sql.push(`insert into public.contact_addresses (contact_id,label,adresse,code_postal,ville,pays,position) values\n${A.map(row).join(',\n')};`);
  sql.push(`do $$ begin if exists (select 1 from pg_trigger where tgname = 'trg_contact_addresses_read_only') then alter table public.contact_addresses enable trigger trg_contact_addresses_read_only; perform public.places_backfill_from_addresses(); end if; end $$;`);

  // 4. themes, works, images, groups
  const ids = (t, c) => psql(`select string_agg("${c}"::text, ',') from public."${t}"`).split(',').map(Number);
  const TECH = ids('Technique', 'TechniqueID'), SUPP = ids('Support', 'SupportID'), FMT = ids('Format', 'FormatID');
  const themeNames = ['Paysage', 'Portrait', 'Mer', 'Forêt', 'Ville', 'Nuit', 'Jardin', 'Corps', 'Lumière', 'Montagne', 'Rivière', 'Atelier', 'Ciel', 'Animaux', 'Fleurs', 'Mémoire', 'Voyage', 'Hiver', 'Été', 'Abstraction', 'Géométrie', 'Ombre', 'Eau', 'Feu', 'Silence'];
  sql.push(`insert into public.theme (name) values ${themeNames.map((n) => `(${lit(n)})`).join(',')};`);
  const W = []; const imgs = []; const OT = [];
  for (let w = 1; w <= N_WORKS; w++) {
    const r = rnd();
    // 12 % in production, 5 % to photograph, 63 % available, 20 % archive (some become sold / out below)
    const stage = r < 0.12 ? 'prod' : r < 0.17 ? 'photo' : r < 0.80 ? 'dispo' : 'archive';
    const cat = stage !== 'prod';
    const statusId = stage === 'archive' ? 3 : stage === 'dispo' ? 2 : stage === 'photo' ? 2 : 1;
    const year = int(1998, 2026);
    const h = pick([20, 24, 30, 40, 50, 60, 65, 81, 100, 130, 162]);
    W.push([w, `Œuvre test ${w}`, pick(TECH), pick(SUPP), pick(FMT), `${year}-01-01`, h, Math.round(h * pick([0.75, 1, 1.25, 1.5])), rnd() < 0.08 ? null : pick([300, 450, 800, 1200, 1800, 2500, 4000, 6500]), statusId, cat, stage === 'photo', rnd() < 0.5]);
    if (stage !== 'prod' || rnd() < 0.5) {
      const hash = crypto.createHash('sha256').update(`w${w}`).digest('hex').slice(0, 8);
      imgs.push({ w, key: `W_${w}_1_${hash}.avif`, hash });
    }
    const t1 = int(1, 25); OT.push([w, t1]); if (rnd() < 0.4) { const t2 = int(1, 25); if (t2 !== t1) OT.push([w, t2]); }
  }
  for (let i = 0; i < W.length; i += 400) {
    sql.push(`insert into public."Oeuvres" ("OeuvreID","Titre","Technique","Support","Format","Année","Hauteur","Largeur","Prix","statusId","Catalogué","NeedsPhotograph","Exposable") values\n${W.slice(i, i + 400).map(row).join(',\n')};`);
  }
  sql.push(`insert into public.oeuvre_theme (oeuvre_id, theme_id) values ${OT.map(row).join(',')} on conflict do nothing;`);
  sql.push(`insert into public."tblImage" ("OeuvreID","txtImageNameLink","txtImageName","SeqNo","is_cover","sha256") values\n${imgs.map((i) => row([i.w, i.key, i.key, 1, true, crypto.createHash('sha256').update(`w${i.w}`).digest('hex')])).join(',\n')};`);
  const G = ['Série Test Mer', 'Série Test Nuit', 'Sélection Salon', 'Commande Test', 'Grands formats'];
  sql.push(`insert into public.working_group (name) values ${G.map((n) => `(${lit(n)})`).join(',')};`);
  const GW = []; for (let g = 1; g <= 5; g++) { const used = new Set(); for (let k = 0; k < int(8, 20); k++) { const w = int(1, N_WORKS); if (!used.has(w)) { used.add(w); GW.push([g, w, k]); } } }
  sql.push(`insert into public.working_group_work (group_id, oeuvre_id, position) select g.id, v.w, v.p from (values ${GW.map(row).join(',')}) v(n, w, p) join (select id, row_number() over (order by name) n from public.working_group) g on g.n = v.n on conflict do nothing;`);

  // 5. past orders (reconstituted): 90 sold + delivered, 18 consigned out at galleries, 4 on loan
  const dispo = W.filter((x) => x[9] === 2 && x[10] && !x[11] && x[8] != null).map((x) => x[0]);
  const take = (n) => dispo.splice(0, n);
  sql.push(`create temp table _o (oid int, ord uuid);`);
  let seq = 0;
  for (const w of take(90)) {
    const buyer = pick(groups.collector); const y = int(2019, 2025); seq++;
    sql.push(`with o as (insert into public.work_order (kind,status,reconstituted,ref,ref_year,ref_seq,party_id,price_final,signed_at,paid_at,delivered_at,created_at)
      values ('sale','delivered',true,'V-${y}-R${String(seq).padStart(3, '0')}',null,null,${buyer},(select "Prix" from public."Oeuvres" where "OeuvreID"=${w}),'${y}-03-01','${y}-03-10','${y}-03-20','${y}-03-01') returning id)
      insert into public.work_order_work (order_id, oeuvre_id, position, price, line_status) select id, ${w}, 0, (select "Prix" from public."Oeuvres" where "OeuvreID"=${w}), 'active' from o;`);
    sql.push(`update public."Oeuvres" set "statusId"=6, "ContactID"=${buyer}, "AcheteurID"=${buyer}, "LocalisationID"=${buyer}, is_paid=true where "OeuvreID"=${w};`);
  }
  let dseq = 0;
  for (const [kind, n, status] of [['consignment', 6, 7], ['loan', 2, 8]]) {
    for (let k = 0; k < n; k++) {
      const party = kind === 'loan' ? pick(groups.institution) : groups.gallery[k % 6]; dseq++;
      const ws = take(kind === 'loan' ? 2 : 3);
      const prefix = kind === 'loan' ? 'P' : 'D';
      sql.push(`with o as (insert into public.work_order (kind,status,reconstituted,ref,ref_year,ref_seq,party_id,start_date,end_date,commission_pct,signed_at,delivered_at)
        values ('${kind}','out',true,'${prefix}-2026-R${String(dseq).padStart(3, '0')}',null,null,${party},'2026-09-01','${k % 2 ? '2026-11-25' : '2027-02-28'}',${kind === 'consignment' ? 40 : 'null'},'2026-08-20','2026-09-01') returning id)
        insert into public.work_order_work (order_id, oeuvre_id, position, price, insurance_value, line_status) select id, w, ord, p, p, 'active' from o,
        (select "OeuvreID" w, row_number() over () - 1 ord, "Prix" p from public."Oeuvres" where "OeuvreID" in (${ws.join(',')})) x;`);
      sql.push(`update public."Oeuvres" set "statusId"=${status}, "LocalisationID"=${party}, "ReturnDate"='${k % 2 ? '2026-11-25' : '2027-02-28'}' where "OeuvreID" in (${ws.join(',')});`);
    }
  }

  // 6. events (exhibitions) + pipeline processes, with selected works
  const P = [
    ['Expo Test Printemps', 'exposition', '2027-03-10', '2027-04-20', 'prevue', groups.gallery[0]],
    ['Expo Test En cours', 'exposition', '2026-11-01', '2026-12-15', 'en_cours', groups.gallery[1]],
    ['Expo Test Passée', 'exposition', '2026-05-01', '2026-06-01', 'terminee', groups.institution[0]],
    ['Salon Test', 'salon', '2027-01-15', '2027-01-18', 'en_cours', null],
    ['Résidence Test', 'residence', '2027-06-01', '2027-07-31', 'en_cours', null],
  ];
  sql.push(`insert into public.suivi_process (nom,type,date_debut,date_fin,statut,contact_id) values ${P.map(row).join(',')};`);
  sql.push(`insert into public.suivi_etape (process_id, nom, statut, position, date_echeance)
    select p.id, s.nom, s.st, s.pos, p.date_debut - s.d from public.suivi_process p cross join (values ('Choisir les œuvres','fait',0,60),('Constats','a_faire',1,10),('Transport','a_faire',2,5)) s(nom,st,pos,d);`);
  sql.push(`insert into public.event_work (process_id, oeuvre_id) select p.id, w from public.suivi_process p cross join lateral
    (select "OeuvreID" w from public."Oeuvres" where "statusId"=2 and "Catalogué" and not "NeedsPhotograph" order by md5(p.nom||"OeuvreID") limit 8) x where p.type='exposition' on conflict do nothing;`);

  // 7. supplies
  const S = []; const cats = ['Toile', 'Peinture', 'Papier', 'Cadre', 'Emballage'];
  for (let k = 1; k <= 40; k++) S.push([`Fourniture test ${k}`, pick(cats), int(0, 30), pick(['pcs', 'm', 'tube', 'feuille']), int(2, 8), pick(groups.supplier), int(2, 120)]);
  sql.push(`insert into public.stock_item (name,category,quantity,unit,min_stock,supplier_id,cost_unit) values ${S.map(row).join(',')};`);

  // counters after explicit ids
  sql.push(`commit;`);
  psql(sql.join('\n'));
  log(`sql: ${C.length} contacts, ${A.length} addresses, ${W.length} works, ${imgs.length} images, ${OT.length} theme links`);

  // 8. placeholder images into the local R2 stub folder (main 1200 px + 400 px thumb)
  if (IMAGES) {
    const sharp = (await import('sharp')).default;
    const root = path.join(here, 'dump', 'r2', 'paintings');
    fs.mkdirSync(path.join(root, 'thumbs'), { recursive: true });
    const hue = (w) => (w * 47) % 360;
    let done = 0;
    for (let i = 0; i < imgs.length; i += 16) {
      await Promise.all(imgs.slice(i, i + 16).map(async ({ w, key }) => {
        const main = path.join(root, key);
        const thumb = path.join(root, 'thumbs', key);
        if (fs.existsSync(main) && fs.existsSync(thumb)) return;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue(w)},45%,55%)"/><stop offset="1" stop-color="hsl(${(hue(w) + 80) % 360},40%,30%)"/></linearGradient></defs><rect width="1200" height="900" fill="url(#g)"/><text x="60" y="840" font-family="Arial" font-size="120" fill="white" opacity="0.8">#${w}</text></svg>`;
        const buf = await sharp(Buffer.from(svg)).avif({ quality: 50, effort: 0 }).toBuffer();
        fs.writeFileSync(main, buf);
        fs.writeFileSync(thumb, await sharp(buf).resize(400).avif({ quality: 70, effort: 0 }).toBuffer());
        done++;
      }));
    }
    log(`images: ${done} written to ${root}`);
  }

  // 9. summary
  console.log(psql(`select 'works '||count(*)||' · by status '||(select string_agg("statusId"||':'||n, ' ' order by "statusId") from (select "statusId", count(*) n from public."Oeuvres" group by 1) x) from public."Oeuvres";
    select 'orders '||count(*)||' · lines '||(select count(*) from public.work_order_work)||' · tasks '||(select count(*) from public.studio_task)||' · versions '||(select count(*) from public.oeuvre_versions)||' · system_log '||(select count(*) from public.system_log)||' · nodes '||(select count(*) from public.nodes) from public.work_order;`));
  log('done');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
