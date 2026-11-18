// Local stand-in for Cloudflare R2 during the stress test (never the real bucket).
// HTTPS :9443 (+ :443 for hosts forced local by net-guard.mjs) = S3 API (PUT / GET / HEAD / DELETE / CopyObject), self-signed cert — the app builds
// `https://${R2_S3_HOST}/...` URLs, so the stress dev server runs with NODE_TLS_REJECT_UNAUTHORIZED=0.
// HTTP  :9444 = public read (NEXT_PUBLIC_R2_PUBLIC_URL), for <img>.
// Objects land in scripts/stress/dump/r2/<bucket>/<key>. Signatures are not checked.
// Usage: node scripts/stress/r2-stub.mjs
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, 'dump', 'r2');
const certDir = path.join(here, 'dump', 'cert');
fs.mkdirSync(root, { recursive: true });
fs.mkdirSync(certDir, { recursive: true });
const key = path.join(certDir, 'key.pem');
const crt = path.join(certDir, 'cert.pem');
if (!fs.existsSync(key)) {
  // openssl ships with Git for Windows.
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '30', '-subj', '/CN=localhost', '-keyout', key, '-out', crt], { stdio: 'ignore' });
}
const stats = { put: 0, get: 0, del: 0, copy: 0, bytes: 0 };
const fileOf = (p) => {
  const clean = decodeURIComponent(p.split('?')[0]).replace(/^\/+/, '');
  const full = path.normalize(path.join(root, clean));
  if (!full.startsWith(root)) throw new Error('bad path');
  return full;
};
const MIME = { avif: 'image/avif', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf', json: 'application/json' };
function serveGet(req, res, file) {
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('<Error><Code>NoSuchKey</Code></Error>'); }
  stats.get++;
  const ext = file.split('.').pop().toLowerCase();
  res.writeHead(200, { 'content-type': MIME[ext] ?? 'application/octet-stream', 'content-length': fs.statSync(file).size, 'access-control-allow-origin': '*' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}
const s3 = (req, res) => {
  let file;
  // Virtual-hosted style (AWS SDK): <bucket>.<account>.eu.r2.cloudflarestorage.com/<key>
  const vh = /^([a-z0-9-]+).[^.]+.(eu.)?r2.cloudflarestorage.com/i.exec(String(req.headers.host || ''));
  const url = vh ? `/${vh[1]}${req.url}` : req.url;
  try { file = fileOf(url); } catch { res.writeHead(400); return res.end(); }
  if (req.method === 'PUT') {
    const src = req.headers['x-amz-copy-source'];
    if (src) {
      // CopyObject: x-amz-copy-source = /bucket/key
      const from = fileOf(String(src).startsWith('/') ? String(src) : `/${src}`);
      if (!fs.existsSync(from)) { res.writeHead(404); return res.end('<Error><Code>NoSuchKey</Code></Error>'); }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.copyFileSync(from, file); stats.copy++;
      res.writeHead(200, { 'content-type': 'application/xml' });
      return res.end('<CopyObjectResult><ETag>"stub"</ETag></CopyObjectResult>');
    }
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buf); stats.put++; stats.bytes += buf.length;
      res.writeHead(200, { etag: '"stub"' }); res.end();
    });
    return;
  }
  if (req.method === 'DELETE') { if (fs.existsSync(file)) fs.rmSync(file); stats.del++; res.writeHead(204); return res.end(); }
  if (req.method === 'GET' || req.method === 'HEAD') return serveGet(req, res, file);
  res.writeHead(405); res.end();
};
const tls = { key: fs.readFileSync(key), cert: fs.readFileSync(crt) };
https.createServer(tls, s3).listen(9443, '127.0.0.1');
https.createServer(tls, s3).listen(443, '127.0.0.1').on('error', (e) => console.log('[r2-stub] :443 not available', e.message));
// Public reads: the public URL has no bucket segment → serve from the work-image bucket.
http.createServer((req, res) => {
  if (req.url === '/__stats') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(stats)); }
  let file; try { file = fileOf(`/paintings${req.url}`); } catch { res.writeHead(400); return res.end(); }
  serveGet(req, res, file);
}).listen(9444, '127.0.0.1');
console.log(`[r2-stub] https://localhost:9443 (S3)  http://localhost:9444 (public)  → ${root}`);
