import { now } from './db.js';

// Log audit. Jangan sekali-kali masukkan nilai rahsia ke dalam `detail`.
export function audit(db, { actor = 'sistem', action, entity = '', entity_id = '', outcome = 'berjaya', reason = '', detail = {}, is_demo = 0 }) {
  db.insert('audit', {
    ts: now(), actor, action, entity, entity_id: String(entity_id ?? ''), outcome, reason,
    detail: JSON.stringify(detail), is_demo: is_demo ? 1 : 0,
  });
}
