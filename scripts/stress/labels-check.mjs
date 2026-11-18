// TODO §4 export labels on the LOCAL copy: generateExport (what the Export dialog calls) for L7163 (image + QR) and
// L7651 (QR), as PDF and HTML; the QR's module grid in the HTML is compared with a fresh encoding of the expected URL.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { call } from './actions.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'dump', 'labels'); fs.mkdirSync(out, { recursive: true });
const ids = [1200, 1199, 1198, 1197, 1196];
const fields = { image: true, title: true, id: true, year: true, technique: true, support: true, dims: true, price: false, status: false, notes: false };
const base = { layout: 'labels', columns: 2, cardsPerPage: 1, rowsPerPage: 0, fields, imageSize: 'small', imageEmbed: 'embedded', imageCrop: 'native', paper: 'a4', orientation: 'portrait', appendList: false, labelStart: 1, labelQr: true, dpi: 300 };
for (const [preset, image] of [['l7163', true], ['l7651', false]]) {
  for (const format of ['pdf', 'html']) {
    const cfg = { ...base, format, labelPreset: preset, fields: { ...fields, image } };
    const r = await call('generateExport', [ids, cfg, {}, {}, {}, 'fr'], { page: '/atelier/inventory', timeoutMs: 120000 });
    if (!r.ok) { console.log(preset, format, 'ERROR', r.error); continue; }
    const { content, filename, mime } = r.result;
    const buf = format === 'pdf' ? Buffer.from(content.replace(/^data:[^,]+,/, ''), 'base64') : Buffer.from(content);
    fs.writeFileSync(path.join(out, `${preset}_${filename}`), buf);
    let qr = '';
    if (format === 'html') {
      const svgs = [...content.matchAll(/<svg[^>]*viewBox="0 0 (\d+) \d+"[^>]*><path fill="#000" d="([^"]+)"/g)];
      const urls = [...content.matchAll(/<div class="q"/g)].length;
      const checks = svgs.slice(0, ids.length).map((m, k) => {
        const n = Number(m[1]); const cells = new Set([...m[2].matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((x) => `${x[2]},${x[1]}`));
        const id = ids[k];
        const want = QRCode.create(`http://localhost:3077/atelier/works/${id}`, { errorCorrectionLevel: 'M' }).modules;
        let same = want.size + 2 === n;
        for (let rr = 0; same && rr < want.size; rr++) for (let cc = 0; cc < want.size; cc++) if ((want.get(rr, cc) === 1) !== cells.has(`${rr + 1},${cc + 1}`)) { same = false; break; }
        return `#${id}:${same ? 'match' : 'DIFF'}`;
      });
      qr = ` qr-blocks=${urls} ${checks.join(' ')}`;
    }
    const head = buf.subarray(0, 8).toString('latin1');
    console.log(preset, format, filename, mime, buf.length, 'bytes', head.startsWith('%PDF') ? 'pdf-ok' : '', qr, `${r.ms} ms`);
  }
}
