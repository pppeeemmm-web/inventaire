// TODO §4 « a real export / a real print (300 dpi) » on the LOCAL copy: generateExport (the Export dialog's call).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { call } from './actions.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'dump', 'labels');
const ids = Array.from({ length: 22 }, (_, i) => 1199 - i);
const fields = { image: true, title: true, id: true, year: true, technique: true, support: true, dims: true, price: true, status: true, notes: false };
const base = { columns: 3, cardsPerPage: 2, rowsPerPage: 0, fields, imageSize: 'large', imageEmbed: 'embedded', imageCrop: 'native', paper: 'a4', orientation: 'portrait', appendList: true, exportTitle: 'Essai copie', colour: 'colour' };
const runs = [
  ['cards pdf 300 dpi', { ...base, format: 'pdf', layout: 'cards', destination: 'pdf', dpi: 300 }],
  ['grid html print 300 dpi', { ...base, format: 'html', layout: 'grid', destination: 'print', dpi: 300 }],
  ['labels html print L7160', { ...base, format: 'html', layout: 'labels', destination: 'print', dpi: 300, labelPreset: 'l7160', labelStart: 3, labelQr: true }],
];
for (const [name, cfg] of runs) {
  const r = await call('generateExport', [ids, cfg, {}, {}, {}, 'fr'], { page: '/atelier/inventory', timeoutMs: 180000 });
  if (!r.ok) { console.log('FAIL', name, r.error); continue; }
  const { content, filename, mime } = r.result;
  const buf = cfg.format === 'pdf' ? Buffer.from(content.replace(/^data:[^,]+,/, ''), 'base64') : Buffer.from(content);
  fs.writeFileSync(path.join(out, `${name.replace(/\W+/g, '_')}_${filename}`), buf);
  const imgs = cfg.format === 'pdf' ? (buf.toString('latin1').match(/\/Subtype \/Image/g) ?? []).length : (content.match(/<img /g) ?? []).length;
  const pages = cfg.format === 'pdf' ? (buf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length : (content.match(/class="sheet"|class="page"/g) ?? []).length;
  console.log('ok  ', name, filename, mime, Math.round(buf.length / 1024), 'KB', 'images', imgs, 'pages', pages, `${r.ms} ms`);
}
