// TODO §4 field capture + waiting photo on the LOCAL copy, through the session actions the screens call.
import sharp from 'sharp';
import { call } from './actions.mjs';
import { psql } from './seed.mjs';
const one = (s) => psql(s);
const jpeg = async (label, color) => sharp({ create: { width: 1600, height: 1200, channels: 3, background: color } })
  .composite([{ input: Buffer.from(`<svg width="1600" height="1200"><text x="100" y="640" font-size="120" fill="white">${label}</text></svg>`), top: 0, left: 0 }]).jpeg().toBuffer();
const form = async (label, color) => { const f = new FormData(); f.append('image', new Blob([await jpeg(label, color)], { type: 'image/jpeg' }), `${label}.jpg`); return f; };
const step = (name, r) => { console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${name} ${r.ok ? '' : r.error} ${JSON.stringify(r.result ?? '').slice(0, 160)}`); return r; };
const W = Number(process.argv[2] || 1196);
const s = step('open session for the day on #' + W, await call('createWorkSessionDraft', [W], { page: '/atelier/session/new' }));
const sid = s.result.id;
step('upload a session shot (not applied)', await call('uploadWorkSessionShot', [sid, await form('waiting photo', '#406080')], { page: '/atelier/session/new' }));
const it = step('add an item (existing work)', await call('createWorkSessionItemAction', [sid, 'existing'], { page: '/atelier/session/new' }));
const itemId = it.result?.item?.id;
const tech = one(`select "TechniqueID" from public."Technique" order by 1 limit 1`); const sup = one(`select "SupportID" from public."Support" order by 1 limit 1`);
step(`write technique ${tech} / support ${sup} on the item`, await call('updateWorkSessionItemMetadata', [sid, itemId, { technique_id: String(tech), support_id: String(sup), notes: 'Essai copie : glacis repris' }], { page: '/atelier/session/new' }));
step('link the item to #' + W, await call('linkWorkSessionItemToOeuvre', [sid, itemId, W], { page: '/atelier/session/new' }));
step('upload the item shot', await call('uploadWorkSessionItemShot', [sid, itemId, await form('item photo', '#805040')], { page: '/atelier/session/new' }));
console.log('session', sid, 'item', itemId);
console.log('db:', one(`select status || ' items=' || (select count(*) from public.work_session_item i where i.session_id = s.id) from public.work_session s where id = '${sid}'`));
