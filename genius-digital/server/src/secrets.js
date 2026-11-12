// Storan rahsia backend. Nilai disulitkan (AES-256-GCM) sebelum disimpan dan TIDAK PERNAH
// dihantar ke browser, ditulis ke log atau dimasukkan ke audit.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, now } from './db.js';

let cachedKey = null;
function masterKey() {
  if (cachedKey) return cachedKey;
  if (process.env.GD_MASTER_KEY) {
    cachedKey = crypto.createHash('sha256').update(process.env.GD_MASTER_KEY).digest();
    return cachedKey;
  }
  // Tiada GD_MASTER_KEY: jana kunci setempat (fail diabaikan git, kebenaran 0600).
  const file = path.join(DATA_DIR, 'master.key');
  if (!fs.existsSync(file)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(file, crypto.randomBytes(32).toString('base64'), { mode: 0o600 });
  }
  cachedKey = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
  return cachedKey;
}

export function setSecret(db, connectorId, value) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', masterKey(), iv);
  const ct = Buffer.concat([c.update(String(value), 'utf8'), c.final()]);
  db.run(
    `INSERT INTO secrets (connector_id, iv, tag, ciphertext, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(connector_id) DO UPDATE SET iv = excluded.iv, tag = excluded.tag, ciphertext = excluded.ciphertext, updated_at = excluded.updated_at`,
    connectorId, iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64'), now());
}

export function deleteSecret(db, connectorId) {
  db.run('DELETE FROM secrets WHERE connector_id = ?', connectorId);
}

// Pulangkan { value, source } atau null. Hanya untuk kegunaan backend.
export function getSecret(db, connectorId, envVar) {
  const row = db.get('SELECT * FROM secrets WHERE connector_id = ?', connectorId);
  if (row) {
    try {
      const d = crypto.createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(row.iv, 'base64'));
      d.setAuthTag(Buffer.from(row.tag, 'base64'));
      const value = Buffer.concat([d.update(Buffer.from(row.ciphertext, 'base64')), d.final()]).toString('utf8');
      return { value, source: 'storan', updated_at: row.updated_at };
    } catch {
      return null; // kunci induk berubah — rahsia perlu dimasukkan semula
    }
  }
  if (envVar && process.env[envVar]) return { value: process.env[envVar], source: 'env' };
  return null;
}

// Maklumat selamat untuk dipaparkan (tanpa nilai).
export function secretStatus(db, connectorId, envVar) {
  const s = getSecret(db, connectorId, envVar);
  const stored = db.get('SELECT updated_at FROM secrets WHERE connector_id = ?', connectorId);
  if (!s) return { has_secret: false, source: null, updated_at: null, unreadable: Boolean(stored) };
  return { has_secret: true, source: s.source, updated_at: s.updated_at || null, unreadable: false };
}

// Buang sebarang rahsia yang diketahui daripada teks ralat sebelum dipaparkan/dilog.
export function redact(text, secret) {
  let out = String(text ?? '');
  if (secret) out = out.split(secret).join('[DIRAHSIAKAN]');
  return out.replace(/(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,})/g, '[DIRAHSIAKAN]').slice(0, 400);
}
