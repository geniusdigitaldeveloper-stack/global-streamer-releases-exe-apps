// Sesi ringkas berasaskan peranan. PIN dibaca daripada environment variables sahaja.
import crypto from 'node:crypto';
import { now, parseJson } from './db.js';

const PIN_ENV = { ceo: 'GD_CEO_PIN', pa: 'GD_PA_PIN' };
const OPEN_ROLES = new Set(['staf', 'pelawat']); // tidak memerlukan PIN walaupun mod selamat
const attempts = new Map();

export const securedMode = () => Boolean(process.env.GD_CEO_PIN);

export function loginOptions(db) {
  const secured = securedMode();
  return {
    secured,
    roles: db.all("SELECT id, key, name, description FROM roles WHERE key != 'agent' ORDER BY id").map((r) => {
      const pinSet = Boolean(process.env[PIN_ENV[r.key]]);
      const needsPin = secured && !OPEN_ROLES.has(r.key);
      return { key: r.key, name: r.name, description: r.description, needs_pin: needsPin, available: !needsPin || pinSet };
    }),
  };
}

export function login(db, { role, pin, name }, ip) {
  const r = db.get("SELECT * FROM roles WHERE key = ? AND key != 'agent'", String(role || ''));
  if (!r) return { error: 'Peranan tidak sah.' };
  if (securedMode() && !OPEN_ROLES.has(r.key)) {
    const expected = process.env[PIN_ENV[r.key]];
    if (!expected) return { error: 'Log masuk untuk peranan ini belum dikonfigurasi (PIN tiada).' };
    const rec = attempts.get(ip) || { n: 0, t: Date.now() };
    if (Date.now() - rec.t > 60_000) { rec.n = 0; rec.t = Date.now(); }
    if (rec.n >= 5) return { error: 'Terlalu banyak cubaan. Cuba semula selepas seminit.', status: 429 };
    const a = crypto.createHash('sha256').update(String(pin ?? '')).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    if (!crypto.timingSafeEqual(a, b)) { rec.n++; attempts.set(ip, rec); return { error: 'PIN salah.', status: 401 }; }
    attempts.delete(ip);
  }
  const token = crypto.randomBytes(32).toString('hex');
  const display = r.key === 'ceo' ? (db.setting('org', {}).ceo_name || 'CEO') : (String(name || '').trim().slice(0, 40) || r.name);
  db.insert('sessions', { token, role_id: r.id, name: display, created_at: now() });
  return { token, session: sessionFor(db, token) };
}

export function sessionFor(db, token) {
  if (!token) return null;
  const s = db.get('SELECT s.name, s.role_id, r.key role_key, r.name role_name, r.permissions FROM sessions s JOIN roles r ON r.id = s.role_id WHERE s.token = ?', token);
  if (!s) return null;
  const p = parseJson(s, ['permissions']);
  return { name: p.name, role_id: p.role_id, role: p.role_key, role_name: p.role_name, permissions: p.permissions || [], secured: securedMode() };
}

export const logout = (db, token) => db.run('DELETE FROM sessions WHERE token = ?', token || '');
