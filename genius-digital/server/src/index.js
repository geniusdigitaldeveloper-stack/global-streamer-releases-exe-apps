// Pelayan GENIUS DIGITAL: API + (dalam produksi) fail statik frontend.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { HttpError, readJson, cookie, send } from './http.js';
import { buildRoutes } from './routes.js';
import { login, logout, loginOptions, sessionFor } from './auth.js';
import { audit } from './audit.js';
import { TaskError } from './tasks.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(here, '../../dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const COOKIE = 'gd_sesi';

export function createApp(db = openDb()) {
  const { router } = buildRoutes();

  async function api(req, res, url) {
    const body = await readJson(req);
    const token = cookie(req, COOKIE);
    const p = url.pathname;
    if (p === '/api/health') return send(res, 200, { ok: true });
    if (p === '/api/auth/options') return send(res, 200, loginOptions(db));
    if (p === '/api/auth/me') return send(res, 200, { session: sessionFor(db, token) });
    if (p === '/api/auth/login' && req.method === 'POST') {
      const out = login(db, body, req.socket.remoteAddress);
      if (out.error) {
        audit(db, { actor: 'tidak diketahui', action: 'log_masuk', outcome: 'ditolak', reason: out.error, detail: { role: String(body.role || '').slice(0, 30) } });
        return send(res, out.status || 400, { error: out.error });
      }
      audit(db, { actor: out.session.name, action: 'log_masuk', detail: { role: out.session.role } });
      return send(res, 200, { session: out.session }, { 'Set-Cookie': `${COOKIE}=${out.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400` });
    }
    if (p === '/api/auth/logout' && req.method === 'POST') {
      logout(db, token);
      return send(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` });
    }
    const session = sessionFor(db, token);
    if (!session) throw new HttpError(401, 'Sila log masuk.');
    const m = router.match(req.method, p);
    if (!m) throw new HttpError(404, 'Laluan tidak ditemui.');
    const ctx = { db, req, res, params: m.params, query: Object.fromEntries(url.searchParams), body, session, actor: session.name };
    let result;
    for (const h of m.handlers) result = await h(ctx);
    return send(res, 200, result ?? { ok: true });
  }

  function serveStatic(req, res, url) {
    let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
    if (!file.startsWith(DIST)) return send(res, 403, { error: 'Dilarang.' });
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('API GENIUS DIGITAL sedang berjalan. Frontend belum dibina: jalankan "npm run build", atau guna "npm run dev".');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) await api(req, res, url);
      else if (req.method === 'GET') serveStatic(req, res, url);
      else send(res, 405, { error: 'Kaedah tidak dibenarkan.' });
    } catch (e) {
      if (e instanceof HttpError || e instanceof TaskError) return send(res, e.status, { error: e.message });
      console.error(`[ralat] ${req.method} ${url.pathname}: ${e.message}`); // tiada badan permintaan dilog
      send(res, 500, { error: 'Ralat pelayan dalaman.' });
    }
  });
  return { server, db };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '127.0.0.1';
  const { server } = createApp();
  server.listen(port, host, () => {
    console.log(`GENIUS DIGITAL API di http://${host}:${port}`);
    if (!process.env.GD_CEO_PIN) console.log('AMARAN: GD_CEO_PIN belum ditetapkan — log masuk CEO terbuka (sesuai untuk demo setempat sahaja).');
  });
}
