// Apply the field session, then check technique / support were written and remove one applied photo. LOCAL copy only.
import { call } from './actions.mjs';
import { psql } from './seed.mjs';
const [sid, itemId, W] = process.argv.slice(2);
const one = (s) => psql(s);
const before = one(`select coalesce("Technique"::text,'-') || '/' || coalesce("Support"::text,'-') || ' imgs=' || (select count(*) from public."tblImage" i where i."OeuvreID" = ${W}) from public."Oeuvres" where "OeuvreID" = ${W}`);
const a = await call('applyWorkSessionToOeuvre', [sid], { page: '/atelier/session/new' });
console.log('apply', a.ok ? 'ok' : a.error);
const after = one(`select coalesce("Technique"::text,'-') || '/' || coalesce("Support"::text,'-') || ' imgs=' || (select count(*) from public."tblImage" i where i."OeuvreID" = ${W}) from public."Oeuvres" where "OeuvreID" = ${W}`);
console.log('work #' + W, 'technique/support + images:', before, '→', after);
const img = one(`select "ImageID" from public."tblImage" where "OeuvreID" = ${W} order by "ImageID" desc limit 1`);
const r = await call('removeAppliedSessionImage', [sid, itemId, Number(img)], { page: '/atelier/session/new' });
console.log('remove applied image', img, r.ok ? 'ok' : r.error, '→ imgs', one(`select count(*) from public."tblImage" where "OeuvreID" = ${W}`), 'recycle:', one(`select count(*) from public."tblImage" where "ImageID" = ${img}`));
