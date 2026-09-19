// Helyi tesztszerver: statikus fájlok + /api/*. Indítás: inditas.bat
import http from 'node:http';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(dir, '.env.local');
if (fs.existsSync(envFile)) {
  for (const l of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const PORT = Number(process.env.PORT) || 3000;

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const api = url.pathname.match(/^\/api\/([a-z]+)$/);
  if (api) {
    const file = path.join(dir, 'api', api[1] + '.js');
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('{}'); }
    const { default: fn } = await import(pathToFileURL(file).href);
    const shim = { status(c) { res.statusCode = c; return shim; }, setHeader: (k, v) => res.setHeader(k, v),
      json(b) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(b)); } };
    return fn(req, shim);
  }
  let p = path.join(dir, decodeURIComponent(url.pathname));
  if (!p.startsWith(dir)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.statusCode = 404; return res.end('404'); }
  res.setHeader('content-type', TYPES[path.extname(p)] || 'application/octet-stream');
  res.setHeader('cache-control', 'no-store');
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => {
  console.log(`\n  KokoAI fut: http://localhost:${PORT}\n  Leallitas: zard be ezt az ablakot.\n`);
  if (process.platform === 'win32') exec(`start "" http://localhost:${PORT}`);
});
