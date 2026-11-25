import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const base = path.join(import.meta.dirname, 'app'), M = { html: 'text/html; charset=utf-8', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', png: 'image/png', wasm: 'application/wasm', webmanifest: 'application/manifest+json' };
http.createServer((q, r) => {
  let u; try { u = decodeURIComponent(new URL(q.url, 'http://x').pathname); } catch { r.writeHead(400).end(); return; }
  const f = path.join(base, u.endsWith('/') ? u + 'index.html' : u);
  if (!f.startsWith(base + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return r.writeHead(404).end();
  r.writeHead(200, { 'Content-Type': M[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(r);
}).listen(5199, '127.0.0.1', () => console.log('http://localhost:5199'));
