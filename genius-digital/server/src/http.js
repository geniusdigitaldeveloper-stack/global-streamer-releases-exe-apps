// Router HTTP minimum (tiada framework).
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function createRouter() {
  const routes = [];
  const add = (method) => (pattern, ...handlers) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, handlers });
  };
  return {
    get: add('GET'), post: add('POST'), put: add('PUT'), delete: add('DELETE'),
    match(method, pathname) {
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = r.re.exec(pathname);
        if (m) return { handlers: r.handlers, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
      }
      return null;
    },
  };
}

export async function readJson(req, limit = 1_000_000) {
  if (req.method === 'GET' || req.method === 'DELETE') return {};
  if (!String(req.headers['content-type'] || '').includes('application/json')) throw new HttpError(415, 'Content-Type mesti application/json.');
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError(413, 'Permintaan terlalu besar.');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'JSON tidak sah.'); }
}

export function cookie(req, name) {
  const m = new RegExp(`(?:^|; )${name}=([^;]+)`).exec(req.headers.cookie || '');
  return m ? m[1] : null;
}

export function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}
