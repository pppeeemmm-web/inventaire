// Preloaded into the stress dev server (NODE_OPTIONS=--import): every *.r2.cloudflarestorage.com lookup
// resolves to 127.0.0.1 (the local R2 stub on :443 / :9443), so no request can reach the real bucket —
// 12 code paths build `https://<account>.eu.r2.cloudflarestorage.com` themselves and ignore R2_S3_HOST.
import dns from 'node:dns';
const R2 = /(^|\.)r2\.cloudflarestorage\.com$/i;
const orig = dns.lookup;
dns.lookup = function (host, opts, cb) {
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  if (R2.test(String(host))) {
    if (opts && opts.all) return process.nextTick(cb, null, [{ address: '127.0.0.1', family: 4 }]);
    return process.nextTick(cb, null, '127.0.0.1', 4);
  }
  return orig.call(dns, host, opts, cb);
};
const origP = dns.promises.lookup;
dns.promises.lookup = (host, opts) => (R2.test(String(host)) ? Promise.resolve(opts && opts.all ? [{ address: '127.0.0.1', family: 4 }] : { address: '127.0.0.1', family: 4 }) : origP.call(dns.promises, host, opts));
