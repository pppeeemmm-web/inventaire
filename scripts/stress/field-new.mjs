// Field capture of a NEW work: technique / support written to Oeuvres on commit (TODO_NOTES session-write-paths a). LOCAL copy only.
import sharp from 'sharp';
import { call } from './actions.mjs';
import { psql } from './seed.mjs';
const one = (s) => psql(s);
const sid = process.argv[2];
const it = await call('createWorkSessionItemAction', [sid, 'new'], { page: '/atelier/session/new' });
const itemId = it.result.item.id;
const tech = one(`select "TechniqueID" || '|' || "Technique" from public."Technique" order by 1 desc limit 1`).split('|');
const sup = one(`select "SupportID" || '|' || "Support" from public."Support" order by 1 desc limit 1`).split('|');
const m = await call('updateWorkSessionItemMetadata', [sid, itemId, { title_hint: 'Essai copie terrain', technique_id: tech[0], support_id: sup[0], width_cm: '30', height_cm: '40', production_origin: 'new' }], { page: '/atelier/session/new' });
const f = new FormData(); f.append('image', new Blob([await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#557755' } }).jpeg().toBuffer()], { type: 'image/jpeg' }), 'new.jpg');
const u = await call('uploadWorkSessionItemShot', [sid, itemId, f], { page: '/atelier/session/new' });
const c = await call('createAndLinkWorkFromSessionItem', [sid, itemId], { page: '/atelier/session/new' });
console.log('item', it.ok, 'meta', m.ok || m.error, 'shot', u.ok || u.error, 'create', c.ok ? JSON.stringify(c.result).slice(0, 120) : c.error);
console.log('wanted', tech, sup);
console.log('newest work:', one(`select "OeuvreID" || ' ' || "Titre" || ' T=' || coalesce("Technique"::text,'-') || ' S=' || coalesce("Support"::text,'-') || ' ' || coalesce("Hauteur"::text,'-') || 'x' || coalesce("Largeur"::text,'-') || ' prod=' || coalesce(production_started_on::text,'-') from public."Oeuvres" order by "OeuvreID" desc limit 1`));
