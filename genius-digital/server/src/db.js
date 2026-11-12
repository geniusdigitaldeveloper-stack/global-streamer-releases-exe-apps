// Pangkalan data SQLite (modul terbina dalam Node, tiada dependency luaran).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seed } from './seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.GD_DATA_DIR || path.resolve(here, '../../data');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, role_id INTEGER NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT DEFAULT '',
  permissions TEXT NOT NULL DEFAULT '[]', is_system INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL,
  x0 REAL, z0 REAL, x1 REAL, z1 REAL, doors TEXT NOT NULL DEFAULT '[]',
  walled INTEGER NOT NULL DEFAULT 1, outdoor INTEGER NOT NULL DEFAULT 0,
  is_private INTEGER NOT NULL DEFAULT 0, description TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS room_access (room_id INTEGER NOT NULL, role_id INTEGER NOT NULL, PRIMARY KEY (room_id, role_id));
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '', room_id INTEGER,
  color TEXT DEFAULT '#c9a45c', active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'agent', avatar TEXT DEFAULT 'lelaki_a',
  role_title TEXT DEFAULT '', role_id INTEGER, department_id INTEGER, description TEXT DEFAULT '',
  skills TEXT NOT NULL DEFAULT '[]', instructions TEXT DEFAULT '', connector_id INTEGER, model TEXT DEFAULT '',
  schedule TEXT DEFAULT '', allowed_tools TEXT NOT NULL DEFAULT '[]', allowed_actions TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'aktif', daily_task_limit INTEGER NOT NULL DEFAULT 20,
  monthly_cost_limit REAL NOT NULL DEFAULT 50, is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS platforms (id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, name TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS agent_platforms (
  agent_id INTEGER NOT NULL, platform_id INTEGER NOT NULL,
  analitik INTEGER NOT NULL DEFAULT 0, draf INTEGER NOT NULL DEFAULT 0,
  jadual INTEGER NOT NULL DEFAULT 0, terbit INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (agent_id, platform_id));
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', department_id INTEGER, agent_id INTEGER,
  action_type TEXT NOT NULL DEFAULT 'rutin', priority TEXT NOT NULL DEFAULT 'sederhana', status TEXT NOT NULL DEFAULT 'baharu',
  success_criteria TEXT DEFAULT '', clear_instructions INTEGER NOT NULL DEFAULT 1, evidence TEXT DEFAULT '',
  policy_conflict INTEGER NOT NULL DEFAULT 0, impact TEXT NOT NULL DEFAULT 'biasa', platform_id INTEGER,
  work_type TEXT DEFAULT 'umum', hold_reason TEXT DEFAULT '', result TEXT DEFAULT '', result_is_simulation INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0, created_by TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, closed_at TEXT);
CREATE TABLE IF NOT EXISTS work_types (
  id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, label TEXT NOT NULL, tool TEXT NOT NULL DEFAULT 'ai',
  connector_id INTEGER, model TEXT DEFAULT '', guidance TEXT DEFAULT '', sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS task_events (id INTEGER PRIMARY KEY, task_id INTEGER NOT NULL, ts TEXT NOT NULL, actor TEXT NOT NULL, event TEXT NOT NULL, detail TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY, task_id INTEGER NOT NULL, agent_id INTEGER, action_type TEXT NOT NULL,
  proposal TEXT DEFAULT '', context TEXT DEFAULT '', evidence TEXT DEFAULT '', risk TEXT NOT NULL DEFAULT 'rendah',
  reasons TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'menunggu', decision_note TEXT DEFAULT '',
  decided_by TEXT, decided_at TEXT, is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS policies (
  action_type TEXT PRIMARY KEY, label TEXT NOT NULL, description TEXT DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'kelulusan', controlled INTEGER NOT NULL DEFAULT 0, sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS workflows (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '', steps TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1, is_demo INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS connectors (
  id INTEGER PRIMARY KEY, provider TEXT NOT NULL, name TEXT NOT NULL, config TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1, last_test_at TEXT, last_test_ok INTEGER, last_test_message TEXT);
CREATE TABLE IF NOT EXISTS secrets (connector_id INTEGER PRIMARY KEY, iv TEXT NOT NULL, tag TEXT NOT NULL, ciphertext TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS usage (
  id INTEGER PRIMARY KEY, agent_id INTEGER, task_id INTEGER, ts TEXT NOT NULL, tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0, cost REAL NOT NULL DEFAULT 0, is_simulation INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY, ts TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, entity TEXT DEFAULT '',
  entity_id TEXT DEFAULT '', outcome TEXT NOT NULL DEFAULT 'berjaya', reason TEXT DEFAULT '', detail TEXT DEFAULT '{}',
  is_demo INTEGER NOT NULL DEFAULT 0);
`;

export const now = () => new Date().toISOString();

export function openDb(file) {
  const target = file || process.env.GD_DB_PATH || path.join(DATA_DIR, 'genius-digital.db');
  if (target !== ':memory:') fs.mkdirSync(path.dirname(target), { recursive: true });
  const db = new DatabaseSync(target);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  const seeded = db.prepare("SELECT value FROM settings WHERE key = 'seeded'").get();
  if (!seeded) seed(db);
  return wrap(db);
}

// Pembungkus kecil supaya kod lain ringkas.
function wrap(db) {
  const api = {
    raw: db,
    all: (sql, ...p) => db.prepare(sql).all(...p),
    get: (sql, ...p) => db.prepare(sql).get(...p),
    run: (sql, ...p) => db.prepare(sql).run(...p),
    insert(table, obj) {
      const keys = Object.keys(obj);
      const r = db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => obj[k]));
      return Number(r.lastInsertRowid);
    },
    update(table, id, obj, idCol = 'id') {
      const keys = Object.keys(obj);
      if (!keys.length) return;
      db.prepare(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(',')} WHERE ${idCol} = ?`).run(...keys.map((k) => obj[k]), id);
    },
    setting(key, fallback = null) {
      const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      return r ? JSON.parse(r.value) : fallback;
    },
    setSetting(key, value) {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
    },
    tx(fn) {
      db.exec('BEGIN');
      try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
  return api;
}

export function parseJson(row, cols) {
  if (!row) return row;
  const out = { ...row };
  for (const c of cols) {
    try { out[c] = JSON.parse(out[c] ?? 'null'); } catch { out[c] = null; }
  }
  return out;
}
