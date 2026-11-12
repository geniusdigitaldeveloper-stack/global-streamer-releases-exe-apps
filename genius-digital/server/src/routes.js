// Semua laluan API. Setiap perubahan direkod dalam log audit.
import { createRouter, HttpError } from './http.js';
import { now, parseJson } from './db.js';
import { audit } from './audit.js';
import { PERMISSIONS } from './seed.js';
import { ADAPTERS, describeConnector, testConnector, resolveGenerator } from './integrations/index.js';
import { setSecret, deleteSecret } from './secrets.js';
import { TOOLS, TASK_STATUSES, TaskError, getTask, runTask, transitionTask, assignTask, decideApproval, addApprovalInfo } from './tasks.js';

const AGENT_JSON = ['skills', 'allowed_tools', 'allowed_actions'];
const str = (v, max = 4000) => String(v ?? '').trim().slice(0, max);
const bool = (v) => (v ? 1 : 0);
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const list = (v) => (Array.isArray(v) ? v : String(v ?? '').split(',')).map((x) => str(x, 80)).filter(Boolean).slice(0, 50);
const idOrNull = (v) => (v === null || v === '' || v === undefined ? null : Number(v));
const required = (v, label) => { if (!str(v)) throw new HttpError(400, `${label} diperlukan.`); return str(v); };
const oneOf = (v, options, label) => { if (!options.includes(v)) throw new HttpError(400, `${label} tidak sah.`); return v; };

export function buildRoutes() {
  const r = createRouter();
  const need = (perm) => (c) => { if (!c.session.permissions.includes(perm)) throw new HttpError(403, 'Anda tiada kebenaran untuk tindakan ini.'); };
  const can = (c, perm) => c.session.permissions.includes(perm);
  const found = (row, what = 'Rekod') => { if (!row) throw new HttpError(404, `${what} tidak ditemui.`); return row; };

  // ---------- Dunia 3D ----------
  r.get('/api/world', (c) => {
    const allowed = new Set(c.db.all('SELECT room_id FROM room_access WHERE role_id = ?', c.session.role_id).map((x) => x.room_id));
    const rooms = c.db.all('SELECT * FROM rooms ORDER BY id').map((x) => ({ ...parseJson(x, ['doors']), can_enter: allowed.has(x.id) }));
    const busy = Object.fromEntries(c.db.all("SELECT agent_id, status, title, result_is_simulation sim FROM tasks WHERE agent_id IS NOT NULL AND status IN ('berjalan','menunggu_kelulusan','dijeda','tindakan_manual') ORDER BY updated_at").map((t) => [t.agent_id, t]));
    const agents = c.db.all("SELECT a.id, a.name, a.kind, a.avatar, a.role_title, a.department_id, a.status, a.description, a.is_demo, d.name department, d.room_id, d.color FROM agents a LEFT JOIN departments d ON d.id = a.department_id ORDER BY a.id")
      .map((a) => ({ ...a, activity: a.status !== 'aktif' ? { state: 'tidak_aktif' } : busy[a.id] ? { state: busy[a.id].status, task: busy[a.id].title, simulation: Boolean(busy[a.id].sim) } : { state: 'sedia' } }));
    return { rooms, agents, demo_mode: c.db.setting('demo_mode', true), org: c.db.setting('org', {}) };
  });

  // ---------- Dashboard ----------
  r.get('/api/dashboard', need('lihat_dashboard'), (c) => {
    const { db } = c;
    const count = (sql, ...p) => db.get(sql, ...p).n;
    const month = new Date().toISOString().slice(0, 7);
    const orgLimit = db.setting('org_monthly_cost_limit', 0);
    const cost = db.get('SELECT COALESCE(SUM(cost),0) c, COALESCE(SUM(tokens_in),0) ti, COALESCE(SUM(tokens_out),0) tk FROM usage WHERE is_simulation = 0 AND ts LIKE ?', `${month}%`);
    const connectors = db.all('SELECT * FROM connectors').map((x) => describeConnector(db, x));
    const alerts = [];
    if (db.setting('demo_mode', true)) alerts.push({ level: 'info', text: 'Mod demo aktif. Aktiviti yang ditanda SIMULASI bukan kerja AI sebenar.' });
    if (!c.session.secured) alerts.push({ level: 'amaran', text: 'PIN CEO belum ditetapkan (GD_CEO_PIN). Sesiapa yang boleh mencapai aplikasi ini boleh log masuk sebagai CEO.' });
    if (!connectors.some((x) => x.kind === 'ai' && x.status === 'aktif')) alerts.push({ level: 'amaran', text: 'Tiada penyedia AI aktif. Tugasan agent dijalankan sebagai simulasi.' });
    if (!connectors.some((x) => x.kind === 'pemasaran' && x.status === 'aktif')) alerts.push({ level: 'info', text: 'Tiada connector pemasaran aktif. Penerbitan dan penjadualan menggunakan aliran manual.' });
    const held = count("SELECT COUNT(*) n FROM tasks WHERE status = 'ditahan'");
    if (held) alerts.push({ level: 'amaran', text: `${held} tugasan ditahan oleh polisi atau had penggunaan.` });
    if (orgLimit > 0 && cost.c >= orgLimit * 0.8) alerts.push({ level: 'amaran', text: `Kos AI bulan ini telah mencapai ${Math.round((cost.c / orgLimit) * 100)}% daripada had organisasi.` });
    return {
      staff: count("SELECT COUNT(*) n FROM agents WHERE kind = 'staf'"),
      agents: count("SELECT COUNT(*) n FROM agents WHERE kind = 'agent'"),
      agents_active: count("SELECT COUNT(*) n FROM agents WHERE status = 'aktif'"),
      departments: count('SELECT COUNT(*) n FROM departments WHERE active = 1'),
      tasks_by_status: Object.fromEntries(db.all('SELECT status, COUNT(*) n FROM tasks GROUP BY status').map((x) => [x.status, x.n])),
      tasks_total: count('SELECT COUNT(*) n FROM tasks'),
      approvals_pending: count("SELECT COUNT(*) n FROM approvals WHERE status IN ('menunggu','maklumat_diminta')"),
      usage: { month, cost: cost.c, tokens_in: cost.ti, tokens_out: cost.tk, limit: orgLimit, simulated_runs: count('SELECT COUNT(*) n FROM usage WHERE is_simulation = 1 AND ts LIKE ?', `${month}%`) },
      by_department: db.all("SELECT d.name, d.color, (SELECT COUNT(*) FROM agents a WHERE a.department_id = d.id) members, (SELECT COUNT(*) FROM tasks t WHERE t.department_id = d.id AND t.status NOT IN ('selesai','ditutup','ditolak')) open_tasks FROM departments d WHERE d.active = 1 ORDER BY d.id"),
      connectors: connectors.map((x) => ({ name: x.name, kind: x.kind, status: x.status })),
      alerts,
      recent: db.all('SELECT id, ts, actor, action, outcome, reason, is_demo FROM audit ORDER BY id DESC LIMIT 8'),
    };
  });

  // ---------- Staf & agent ----------
  const agentRow = (db, id) => parseJson(db.get('SELECT * FROM agents WHERE id = ?', id), AGENT_JSON);
  function agentInput(c, b, existing = {}) {
    const has = (k) => Object.hasOwn(b, k);
    const o = {};
    if (has('name') || !existing.id) o.name = required(b.name, 'Nama');
    if (has('kind')) o.kind = oneOf(b.kind, ['staf', 'agent'], 'Jenis');
    for (const k of ['avatar', 'role_title', 'model', 'schedule']) if (has(k)) o[k] = str(b[k], 200);
    for (const k of ['description', 'instructions']) if (has(k)) o[k] = str(b[k], 8000);
    for (const k of ['role_id', 'department_id', 'connector_id']) if (has(k)) o[k] = idOrNull(b[k]);
    for (const k of ['skills', 'allowed_tools']) if (has(k)) o[k] = JSON.stringify(list(b[k]));
    if (has('allowed_actions')) {
      const valid = new Set(c.db.all('SELECT action_type FROM policies').map((p) => p.action_type));
      o.allowed_actions = JSON.stringify(list(b.allowed_actions).filter((a) => valid.has(a)));
    }
    if (has('status')) o.status = oneOf(b.status, ['aktif', 'tidak_aktif'], 'Status');
    if (has('daily_task_limit')) o.daily_task_limit = Math.max(0, Math.round(num(b.daily_task_limit, 20)));
    if (has('monthly_cost_limit')) o.monthly_cost_limit = Math.max(0, num(b.monthly_cost_limit, 50));
    if (o.role_id) {
      const role = found(c.db.get('SELECT key FROM roles WHERE id = ?', o.role_id), 'Peranan');
      if (role.key === 'ceo') throw new HttpError(400, 'Peranan CEO dikhaskan untuk pengguna.');
    }
    return o;
  }
  r.get('/api/agents', (c) => {
    const rows = c.db.all('SELECT a.*, d.name department, ro.name role_name, cn.name connector_name FROM agents a LEFT JOIN departments d ON d.id = a.department_id LEFT JOIN roles ro ON ro.id = a.role_id LEFT JOIN connectors cn ON cn.id = a.connector_id ORDER BY a.kind DESC, a.id')
      .map((a) => parseJson(a, AGENT_JSON));
    if (can(c, 'urus_staf')) return rows.map((a) => ({ ...a, ai_live: Boolean(resolveGenerator(c.db, a)) }));
    return rows.map(({ id, name, kind, avatar, role_title, department, department_id, description, skills, status, is_demo }) => ({ id, name, kind, avatar, role_title, department, department_id, description, skills, status, is_demo }));
  });
  r.post('/api/agents', need('urus_staf'), (c) => {
    const o = agentInput(c, c.body);
    const id = c.db.insert('agents', { kind: 'agent', skills: '[]', allowed_tools: '[]', allowed_actions: '["rutin"]', ...o, created_at: now(), updated_at: now() });
    audit(c.db, { actor: c.actor, action: 'profil_dicipta', entity: 'agent', entity_id: id, detail: { name: o.name, allowed_actions: o.allowed_actions }, outcome: 'berjaya', reason: o.allowed_actions ? 'Kebenaran awal ditetapkan (perubahan akses).' : '' });
    return agentRow(c.db, id);
  });
  r.put('/api/agents/:id', need('urus_staf'), (c) => {
    const before = found(agentRow(c.db, c.params.id), 'Profil');
    const o = agentInput(c, c.body, before);
    c.db.update('agents', before.id, { ...o, updated_at: now() });
    const accessChanged = ['allowed_actions', 'role_id', 'allowed_tools', 'status'].filter((k) => k in o && String(o[k]) !== (Array.isArray(before[k]) ? JSON.stringify(before[k]) : String(before[k])));
    audit(c.db, { actor: c.actor, action: accessChanged.length ? 'akses_diubah' : 'profil_dikemas_kini', entity: 'agent', entity_id: before.id, detail: { name: before.name, fields: Object.keys(o), akses: accessChanged } });
    return agentRow(c.db, before.id);
  });
  r.delete('/api/agents/:id', need('urus_staf'), (c) => {
    const a = found(agentRow(c.db, c.params.id), 'Profil');
    c.db.tx(() => {
      c.db.run("UPDATE tasks SET agent_id = NULL, status = CASE WHEN status IN ('diagihkan','berjalan','dijeda') THEN 'baharu' ELSE status END WHERE agent_id = ?", a.id);
      c.db.run("UPDATE approvals SET status = 'dibatalkan', decision_note = 'Agent dipadam.' WHERE agent_id = ? AND status IN ('menunggu','maklumat_diminta')", a.id);
      c.db.run('DELETE FROM agent_platforms WHERE agent_id = ?', a.id);
      c.db.run('DELETE FROM agents WHERE id = ?', a.id);
    });
    audit(c.db, { actor: c.actor, action: 'profil_dipadam', entity: 'agent', entity_id: a.id, detail: { name: a.name, kind: a.kind } });
    return { ok: true };
  });
  r.get('/api/agents/:id/platforms', need('urus_staf'), (c) =>
    c.db.all('SELECT p.id platform_id, p.key, p.name, p.enabled, COALESCE(ap.analitik,0) analitik, COALESCE(ap.draf,0) draf, COALESCE(ap.jadual,0) jadual, COALESCE(ap.terbit,0) terbit FROM platforms p LEFT JOIN agent_platforms ap ON ap.platform_id = p.id AND ap.agent_id = ? ORDER BY p.id', c.params.id));
  r.put('/api/agents/:id/platforms', need('urus_staf'), (c) => {
    const a = found(agentRow(c.db, c.params.id), 'Profil');
    const items = Array.isArray(c.body.platforms) ? c.body.platforms : [];
    c.db.tx(() => {
      c.db.run('DELETE FROM agent_platforms WHERE agent_id = ?', a.id);
      for (const p of items) {
        const row = { agent_id: a.id, platform_id: Number(p.platform_id), analitik: bool(p.analitik), draf: bool(p.draf), jadual: bool(p.jadual), terbit: bool(p.terbit) };
        if (row.analitik || row.draf || row.jadual || row.terbit) c.db.insert('agent_platforms', row);
      }
    });
    audit(c.db, { actor: c.actor, action: 'akses_platform_diubah', entity: 'agent', entity_id: a.id, detail: { name: a.name, platforms: items.filter((p) => p.analitik || p.draf || p.jadual || p.terbit).map((p) => p.platform_id) } });
    return { ok: true };
  });

  // ---------- Jabatan ----------
  r.get('/api/departments', (c) => c.db.all('SELECT d.*, ro.name room_name, (SELECT COUNT(*) FROM agents a WHERE a.department_id = d.id) members FROM departments d LEFT JOIN rooms ro ON ro.id = d.room_id ORDER BY d.id'));
  const deptInput = (b) => ({ name: required(b.name, 'Nama jabatan'), description: str(b.description), room_id: idOrNull(b.room_id), color: /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#c9a45c', active: bool(b.active ?? 1) });
  r.post('/api/departments', need('urus_organisasi'), (c) => {
    const id = c.db.insert('departments', deptInput(c.body));
    audit(c.db, { actor: c.actor, action: 'jabatan_dicipta', entity: 'jabatan', entity_id: id, detail: { name: c.body.name } });
    return { id };
  });
  r.put('/api/departments/:id', need('urus_organisasi'), (c) => {
    found(c.db.get('SELECT id FROM departments WHERE id = ?', c.params.id), 'Jabatan');
    c.db.update('departments', c.params.id, deptInput(c.body));
    audit(c.db, { actor: c.actor, action: 'jabatan_dikemas_kini', entity: 'jabatan', entity_id: c.params.id, detail: { name: c.body.name } });
    return { ok: true };
  });
  r.delete('/api/departments/:id', need('urus_organisasi'), (c) => {
    const d = found(c.db.get('SELECT * FROM departments WHERE id = ?', c.params.id), 'Jabatan');
    const n = c.db.get('SELECT COUNT(*) n FROM agents WHERE department_id = ?', d.id).n;
    if (n) {
      audit(c.db, { actor: c.actor, action: 'jabatan_dipadam', entity: 'jabatan', entity_id: d.id, outcome: 'ditolak', reason: `Masih ada ${n} ahli.` });
      throw new HttpError(409, `Jabatan masih mempunyai ${n} ahli. Pindahkan mereka dahulu.`);
    }
    c.db.run('UPDATE tasks SET department_id = NULL WHERE department_id = ?', d.id);
    c.db.run('DELETE FROM departments WHERE id = ?', d.id);
    audit(c.db, { actor: c.actor, action: 'jabatan_dipadam', entity: 'jabatan', entity_id: d.id, detail: { name: d.name } });
    return { ok: true };
  });

  // ---------- Peranan & akses ruang ----------
  r.get('/api/roles', (c) => ({
    permissions: PERMISSIONS.map(([key, label]) => ({ key, label })),
    roles: c.db.all('SELECT * FROM roles ORDER BY id').map((x) => parseJson(x, ['permissions'])),
  }));
  const permList = (v) => list(v).filter((p) => PERMISSIONS.some(([k]) => k === p));
  r.post('/api/roles', need('urus_organisasi'), (c) => {
    const name = required(c.body.name, 'Nama peranan');
    const key = `peranan_${Date.now().toString(36)}`;
    const id = c.db.insert('roles', { key, name, description: str(c.body.description), permissions: JSON.stringify(permList(c.body.permissions)) });
    audit(c.db, { actor: c.actor, action: 'peranan_dicipta', entity: 'peranan', entity_id: id, detail: { name, permissions: permList(c.body.permissions) } });
    return { id };
  });
  r.put('/api/roles/:id', need('urus_organisasi'), (c) => {
    const role = found(c.db.get('SELECT * FROM roles WHERE id = ?', c.params.id), 'Peranan');
    if (role.key === 'ceo') throw new HttpError(400, 'Peranan CEO sentiasa mempunyai semua kebenaran dan tidak boleh diubah.');
    const o = { name: required(c.body.name, 'Nama peranan'), description: str(c.body.description), permissions: JSON.stringify(permList(c.body.permissions)) };
    c.db.update('roles', role.id, o);
    audit(c.db, { actor: c.actor, action: 'akses_diubah', entity: 'peranan', entity_id: role.id, detail: { name: o.name, sebelum: JSON.parse(role.permissions), selepas: permList(c.body.permissions) } });
    return { ok: true };
  });
  r.delete('/api/roles/:id', need('urus_organisasi'), (c) => {
    const role = found(c.db.get('SELECT * FROM roles WHERE id = ?', c.params.id), 'Peranan');
    if (role.is_system) throw new HttpError(400, 'Peranan sistem tidak boleh dipadam.');
    if (c.db.get('SELECT COUNT(*) n FROM agents WHERE role_id = ?', role.id).n) throw new HttpError(409, 'Peranan masih digunakan oleh staf atau agent.');
    c.db.run('DELETE FROM room_access WHERE role_id = ?', role.id);
    c.db.run('DELETE FROM sessions WHERE role_id = ?', role.id);
    c.db.run('DELETE FROM roles WHERE id = ?', role.id);
    audit(c.db, { actor: c.actor, action: 'peranan_dipadam', entity: 'peranan', entity_id: role.id, detail: { name: role.name } });
    return { ok: true };
  });
  r.get('/api/rooms', (c) => {
    const acc = c.db.all('SELECT * FROM room_access');
    return c.db.all('SELECT id, key, name, type, outdoor, is_private, walled, description FROM rooms ORDER BY id')
      .map((x) => ({ ...x, role_ids: acc.filter((a) => a.room_id === x.id).map((a) => a.role_id) }));
  });
  r.put('/api/rooms/:id/access', need('urus_organisasi'), (c) => {
    const room = found(c.db.get('SELECT * FROM rooms WHERE id = ?', c.params.id), 'Ruang');
    const roles = c.db.all('SELECT id, key FROM roles');
    let ids = [...new Set((c.body.role_ids || []).map(Number))].filter((id) => roles.some((x) => x.id === id));
    const ceo = roles.find((x) => x.key === 'ceo').id;
    if (!ids.includes(ceo)) ids.push(ceo); // CEO sentiasa ada akses
    if (room.is_private) {
      const allowedKeys = new Set(['ceo', 'pa']);
      const bad = ids.filter((id) => !allowedKeys.has(roles.find((x) => x.id === id).key));
      if (bad.length) {
        audit(c.db, { actor: c.actor, action: 'akses_ruang_diubah', entity: 'ruang', entity_id: room.id, outcome: 'ditolak', reason: 'Ruang peribadi hanya untuk CEO dan PA.' });
        throw new HttpError(400, `${room.name} ialah ruang peribadi. Hanya CEO dan PA boleh diberi akses.`);
      }
    }
    c.db.tx(() => {
      c.db.run('DELETE FROM room_access WHERE room_id = ?', room.id);
      for (const id of ids) c.db.insert('room_access', { room_id: room.id, role_id: id });
    });
    audit(c.db, { actor: c.actor, action: 'akses_ruang_diubah', entity: 'ruang', entity_id: room.id, detail: { ruang: room.name, role_ids: ids } });
    return { ok: true };
  });

  // ---------- Tugasan ----------
  const TASK_SELECT = 'SELECT t.*, a.name agent_name, d.name department, p.name platform, po.label action_label, wt.label work_label FROM tasks t LEFT JOIN agents a ON a.id = t.agent_id LEFT JOIN departments d ON d.id = t.department_id LEFT JOIN platforms p ON p.id = t.platform_id LEFT JOIN policies po ON po.action_type = t.action_type LEFT JOIN work_types wt ON wt.key = t.work_type';
  function taskInput(c, b, creating) {
    const has = (k) => Object.hasOwn(b, k);
    const o = {};
    if (creating || has('title')) o.title = required(b.title, 'Tajuk');
    for (const k of ['description', 'success_criteria', 'evidence']) if (has(k)) o[k] = str(b[k], 8000);
    for (const k of ['department_id', 'platform_id']) if (has(k)) o[k] = idOrNull(b[k]);
    if (has('action_type')) o.action_type = found(c.db.get('SELECT action_type FROM policies WHERE action_type = ?', b.action_type), 'Jenis tindakan').action_type;
    if (has('work_type')) o.work_type = found(c.db.get('SELECT key FROM work_types WHERE key = ?', b.work_type), 'Jenis kerja').key;
    if (has('priority')) o.priority = oneOf(b.priority, ['rendah', 'sederhana', 'tinggi'], 'Keutamaan');
    if (has('impact')) o.impact = oneOf(b.impact, ['biasa', 'penting'], 'Kesan');
    if (has('clear_instructions')) o.clear_instructions = bool(b.clear_instructions);
    if (has('policy_conflict')) o.policy_conflict = bool(b.policy_conflict);
    return o;
  }
  r.get('/api/tasks', (c) => {
    const where = [];
    const p = [];
    if (c.query.status) { where.push('t.status = ?'); p.push(c.query.status); }
    if (c.query.agent_id) { where.push('t.agent_id = ?'); p.push(c.query.agent_id); }
    return { statuses: TASK_STATUSES, tasks: c.db.all(`${TASK_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY t.updated_at DESC, t.id DESC`, ...p) };
  });
  r.get('/api/tasks/:id', (c) => {
    const t = found(c.db.get(`${TASK_SELECT} WHERE t.id = ?`, c.params.id), 'Tugasan');
    return { ...t, events: c.db.all('SELECT * FROM task_events WHERE task_id = ? ORDER BY id', t.id), approvals: c.db.all('SELECT * FROM approvals WHERE task_id = ? ORDER BY id', t.id).map((a) => parseJson(a, ['reasons'])) };
  });
  r.post('/api/tasks', need('urus_tugasan'), (c) => {
    const o = taskInput(c, c.body, true);
    const agentId = idOrNull(c.body.agent_id);
    if (agentId) found(c.db.get('SELECT id FROM agents WHERE id = ?', agentId), 'Agent');
    const id = c.db.insert('tasks', { ...o, agent_id: agentId, status: agentId ? 'diagihkan' : 'baharu', created_by: c.actor, created_at: now(), updated_at: now() });
    c.db.insert('task_events', { task_id: id, ts: now(), actor: c.actor, event: 'dicipta', detail: '' });
    audit(c.db, { actor: c.actor, action: 'tugasan_dicipta', entity: 'tugasan', entity_id: id, detail: { title: o.title, action_type: o.action_type || 'rutin', agent_id: agentId } });
    return getTask(c.db, id);
  });
  r.put('/api/tasks/:id', need('urus_tugasan'), (c) => {
    const t = getTask(c.db, c.params.id);
    if (['selesai', 'ditutup', 'ditolak'].includes(t.status)) throw new HttpError(409, 'Tugasan yang telah tamat tidak boleh diedit.');
    const o = taskInput(c, c.body, false);
    c.db.update('tasks', t.id, { ...o, updated_at: now() });
    c.db.insert('task_events', { task_id: t.id, ts: now(), actor: c.actor, event: 'dikemas_kini', detail: Object.keys(o).join(', ') });
    audit(c.db, { actor: c.actor, action: 'tugasan_dikemas_kini', entity: 'tugasan', entity_id: t.id, detail: { fields: Object.keys(o) }, is_demo: t.is_demo });
    return getTask(c.db, t.id);
  });
  r.post('/api/tasks/:id/assign', need('urus_tugasan'), (c) => assignTask(c.db, c.params.id, idOrNull(c.body.agent_id), c.actor));
  r.post('/api/tasks/:id/run', need('urus_tugasan'), (c) => {
    const conf = c.body.confidence == null || c.body.confidence === '' ? null : Math.min(1, Math.max(0, num(c.body.confidence)));
    return runTask(c.db, c.params.id, c.actor, { confidence: conf });
  });
  for (const action of ['pause', 'resume', 'complete', 'close'])
    r.post(`/api/tasks/:id/${action}`, need('urus_tugasan'), (c) => transitionTask(c.db, c.params.id, action, c.actor, str(c.body.note, 500)));

  // ---------- Kelulusan ----------
  r.get('/api/approvals', need('lulus_tindakan'), (c) => {
    const pending = c.query.status !== 'semua';
    return c.db.all(`SELECT ap.*, a.name agent_name, t.title task_title, t.status task_status, po.label action_label, d.name department
      FROM approvals ap LEFT JOIN agents a ON a.id = ap.agent_id LEFT JOIN tasks t ON t.id = ap.task_id LEFT JOIN policies po ON po.action_type = ap.action_type LEFT JOIN departments d ON d.id = t.department_id
      ${pending ? "WHERE ap.status IN ('menunggu','maklumat_diminta')" : ''} ORDER BY ap.id DESC LIMIT 200`).map((a) => parseJson(a, ['reasons']));
  });
  r.post('/api/approvals/:id/decide', need('lulus_tindakan'), (c) =>
    decideApproval(c.db, c.params.id, c.actor, { decision: c.body.decision, note: str(c.body.note, 2000), proposal: c.body.proposal }));
  r.post('/api/approvals/:id/info', need('urus_tugasan'), (c) => { addApprovalInfo(c.db, c.params.id, c.actor, str(c.body.info, 4000)); return { ok: true }; });

  // ---------- Polisi & workflow ----------
  r.get('/api/policies', (c) => ({ policies: c.db.all('SELECT * FROM policies ORDER BY sort'), confidence_threshold: c.db.setting('confidence_threshold', 0.8) }));
  r.put('/api/policies/:type', need('urus_polisi'), (c) => {
    const p = found(c.db.get('SELECT * FROM policies WHERE action_type = ?', c.params.type), 'Polisi');
    const mode = oneOf(c.body.mode, ['auto', 'kelulusan', 'sekat'], 'Mod');
    if (p.controlled && mode === 'auto') {
      audit(c.db, { actor: c.actor, action: 'polisi_diubah', entity: 'polisi', entity_id: p.action_type, outcome: 'ditolak', reason: 'Tindakan terkawal tidak boleh ditetapkan kepada automatik.' });
      throw new HttpError(400, `"${p.label}" ialah tindakan terkawal dan mesti melalui kelulusan atau disekat.`);
    }
    c.db.update('policies', p.action_type, { mode }, 'action_type');
    audit(c.db, { actor: c.actor, action: 'polisi_diubah', entity: 'polisi', entity_id: p.action_type, detail: { sebelum: p.mode, selepas: mode } });
    return { ok: true };
  });
  r.get('/api/workflows', (c) => c.db.all('SELECT * FROM workflows ORDER BY id').map((w) => parseJson(w, ['steps'])));
  function workflowInput(c, b) {
    const valid = new Set(c.db.all('SELECT action_type FROM policies').map((p) => p.action_type));
    const controlled = new Set(c.db.all('SELECT action_type FROM policies WHERE controlled = 1').map((p) => p.action_type));
    const steps = (Array.isArray(b.steps) ? b.steps : []).slice(0, 30).map((s) => {
      const action_type = valid.has(s.action_type) ? s.action_type : 'rutin';
      return { name: required(s.name, 'Nama langkah'), department: str(s.department, 80), action_type, approval: controlled.has(action_type) ? true : Boolean(s.approval) };
    });
    return { name: required(b.name, 'Nama workflow'), description: str(b.description), steps: JSON.stringify(steps), active: bool(b.active ?? 1) };
  }
  r.post('/api/workflows', need('urus_polisi'), (c) => {
    const id = c.db.insert('workflows', workflowInput(c, c.body));
    audit(c.db, { actor: c.actor, action: 'workflow_dicipta', entity: 'workflow', entity_id: id, detail: { name: c.body.name } });
    return { id };
  });
  r.put('/api/workflows/:id', need('urus_polisi'), (c) => {
    found(c.db.get('SELECT id FROM workflows WHERE id = ?', c.params.id), 'Workflow');
    c.db.update('workflows', c.params.id, workflowInput(c, c.body));
    audit(c.db, { actor: c.actor, action: 'workflow_dikemas_kini', entity: 'workflow', entity_id: c.params.id, detail: { name: c.body.name } });
    return { ok: true };
  });
  r.delete('/api/workflows/:id', need('urus_polisi'), (c) => {
    const w = found(c.db.get('SELECT * FROM workflows WHERE id = ?', c.params.id), 'Workflow');
    c.db.run('DELETE FROM workflows WHERE id = ?', w.id);
    audit(c.db, { actor: c.actor, action: 'workflow_dipadam', entity: 'workflow', entity_id: w.id, detail: { name: w.name } });
    return { ok: true };
  });

  // ---------- Jenis kerja & alat AI ----------
  r.get('/api/work-types', (c) => ({
    tools: Object.entries(TOOLS).map(([key, t]) => ({ key, label: t.label })),
    repos: c.db.setting('repos', []),
    work_types: c.db.all('SELECT w.*, cn.name connector_name FROM work_types w LEFT JOIN connectors cn ON cn.id = w.connector_id ORDER BY w.sort, w.id'),
  }));
  const wtInput = (b) => ({ label: required(b.label, 'Nama jenis kerja'), tool: oneOf(b.tool, Object.keys(TOOLS), 'Alat'), connector_id: idOrNull(b.connector_id), model: str(b.model, 120), guidance: str(b.guidance, 8000) });
  r.post('/api/work-types', need('urus_polisi'), (c) => {
    const o = wtInput(c.body);
    const id = c.db.insert('work_types', { ...o, key: `kerja_${Date.now().toString(36)}`, sort: 99 });
    audit(c.db, { actor: c.actor, action: 'jenis_kerja_dicipta', entity: 'jenis_kerja', entity_id: id, detail: { label: o.label, tool: o.tool } });
    return { id };
  });
  r.put('/api/work-types/:id', need('urus_polisi'), (c) => {
    found(c.db.get('SELECT id FROM work_types WHERE id = ?', c.params.id), 'Jenis kerja');
    const o = wtInput(c.body);
    c.db.update('work_types', c.params.id, o);
    audit(c.db, { actor: c.actor, action: 'jenis_kerja_dikemas_kini', entity: 'jenis_kerja', entity_id: c.params.id, detail: { label: o.label, tool: o.tool, connector_id: o.connector_id } });
    return { ok: true };
  });
  r.delete('/api/work-types/:id', need('urus_polisi'), (c) => {
    const w = found(c.db.get('SELECT * FROM work_types WHERE id = ?', c.params.id), 'Jenis kerja');
    if (w.key === 'umum') throw new HttpError(400, 'Jenis kerja umum tidak boleh dipadam.');
    c.db.run("UPDATE tasks SET work_type = 'umum' WHERE work_type = ?", w.key);
    c.db.run('DELETE FROM work_types WHERE id = ?', w.id);
    audit(c.db, { actor: c.actor, action: 'jenis_kerja_dipadam', entity: 'jenis_kerja', entity_id: w.id, detail: { label: w.label } });
    return { ok: true };
  });
  r.put('/api/repos', need('urus_polisi'), (c) => {
    const repos = (Array.isArray(c.body.repos) ? c.body.repos : []).slice(0, 50).map((x) => ({ name: required(x.name, 'Nama repo'), location: str(x.location, 300), purpose: str(x.purpose, 500) }));
    c.db.setSetting('repos', repos);
    audit(c.db, { actor: c.actor, action: 'repo_dikemas_kini', entity: 'tetapan', detail: { repos: repos.map((x) => x.name) } });
    return { ok: true };
  });

  // ---------- Platform media sosial (allowlist) ----------
  r.get('/api/platforms', (c) => c.db.all('SELECT * FROM platforms ORDER BY id'));
  r.post('/api/platforms', need('urus_integrasi'), (c) => {
    const name = required(c.body.name, 'Nama platform');
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `platform_${Date.now()}`;
    if (c.db.get('SELECT id FROM platforms WHERE key = ?', key)) throw new HttpError(409, 'Platform ini sudah wujud.');
    const id = c.db.insert('platforms', { key, name, enabled: 0 });
    audit(c.db, { actor: c.actor, action: 'platform_ditambah', entity: 'platform', entity_id: id, detail: { name } });
    return { id };
  });
  r.put('/api/platforms/:id', need('urus_integrasi'), (c) => {
    const p = found(c.db.get('SELECT * FROM platforms WHERE id = ?', c.params.id), 'Platform');
    c.db.update('platforms', p.id, { enabled: bool(c.body.enabled) });
    audit(c.db, { actor: c.actor, action: 'allowlist_platform_diubah', entity: 'platform', entity_id: p.id, detail: { name: p.name, dibenarkan: Boolean(c.body.enabled) } });
    return { ok: true };
  });

  // ---------- Connector & rahsia ----------
  const connector = (c) => found(c.db.get('SELECT * FROM connectors WHERE id = ?', c.params.id), 'Connector');
  r.get('/api/connectors', need('urus_integrasi'), (c) => ({
    providers: Object.values(ADAPTERS).map((a) => ({ provider: a.provider, label: a.label, kind: a.kind })),
    connectors: c.db.all('SELECT * FROM connectors ORDER BY id').map((x) => describeConnector(c.db, x)),
  }));
  r.get('/api/connectors/ai', (c) => c.db.all('SELECT * FROM connectors ORDER BY id').map((x) => describeConnector(c.db, x)).filter((x) => x.kind === 'ai').map(({ id, name, status, models, config }) => ({ id, name, status, models, default_model: config.default_model || '' })));
  r.post('/api/connectors', need('urus_integrasi'), (c) => {
    const a = ADAPTERS[c.body.provider];
    if (!a) throw new HttpError(400, 'Penyedia tidak disokong.');
    const id = c.db.insert('connectors', { provider: a.provider, name: str(c.body.name, 80) || a.label, config: JSON.stringify({ base_url: a.configFields.find((f) => f.key === 'base_url')?.placeholder?.startsWith('http') ? a.configFields.find((f) => f.key === 'base_url').placeholder : undefined }) });
    audit(c.db, { actor: c.actor, action: 'connector_ditambah', entity: 'connector', entity_id: id, detail: { provider: a.provider } });
    return { id };
  });
  r.put('/api/connectors/:id', need('urus_integrasi'), (c) => {
    const row = connector(c);
    const a = ADAPTERS[row.provider];
    const config = { models_cache: JSON.parse(row.config || '{}').models_cache };
    for (const f of a?.configFields || []) config[f.key] = str(c.body.config?.[f.key], 300);
    // Konfigurasi berubah → keputusan ujian lama tidak lagi sah.
    c.db.update('connectors', row.id, { name: str(c.body.name, 80) || row.name, config: JSON.stringify(config), last_test_ok: null, last_test_message: null, last_test_at: null });
    audit(c.db, { actor: c.actor, action: 'connector_dikonfigurasi', entity: 'connector', entity_id: row.id, detail: { provider: row.provider, fields: Object.keys(config) } });
    return describeConnector(c.db, connector(c));
  });
  r.post('/api/connectors/:id/secret', need('urus_integrasi'), (c) => {
    const row = connector(c);
    const value = String(c.body.value ?? '').trim();
    if (value.length < 3 || value.length > 500) throw new HttpError(400, 'Nilai rahsia tidak sah.');
    const replacing = Boolean(c.db.get('SELECT 1 x FROM secrets WHERE connector_id = ?', row.id));
    setSecret(c.db, row.id, value);
    c.db.update('connectors', row.id, { last_test_ok: null, last_test_message: null, last_test_at: null });
    audit(c.db, { actor: c.actor, action: replacing ? 'rahsia_diganti' : 'rahsia_disimpan', entity: 'connector', entity_id: row.id, detail: { provider: row.provider } }); // nilai tidak direkod
    return describeConnector(c.db, connector(c));
  });
  r.delete('/api/connectors/:id/secret', need('urus_integrasi'), (c) => {
    const row = connector(c);
    deleteSecret(c.db, row.id);
    c.db.update('connectors', row.id, { last_test_ok: null, last_test_message: null, last_test_at: null });
    audit(c.db, { actor: c.actor, action: 'rahsia_dipadam', entity: 'connector', entity_id: row.id, detail: { provider: row.provider } });
    return describeConnector(c.db, connector(c));
  });
  r.post('/api/connectors/:id/test', need('urus_integrasi'), async (c) => {
    const row = connector(c);
    const result = await testConnector(c.db, row.id);
    audit(c.db, { actor: c.actor, action: 'connector_diuji', entity: 'connector', entity_id: row.id, outcome: result.ok ? 'berjaya' : 'gagal', reason: result.message, detail: { provider: row.provider } });
    return { result, connector: describeConnector(c.db, connector(c)) };
  });
  r.post('/api/connectors/:id/enabled', need('urus_integrasi'), (c) => {
    const row = connector(c);
    c.db.update('connectors', row.id, { enabled: bool(c.body.enabled) });
    audit(c.db, { actor: c.actor, action: c.body.enabled ? 'connector_diaktifkan' : 'connector_dinyahaktifkan', entity: 'connector', entity_id: row.id, detail: { provider: row.provider } });
    return describeConnector(c.db, connector(c));
  });
  r.delete('/api/connectors/:id', need('urus_integrasi'), (c) => {
    const row = connector(c);
    c.db.tx(() => {
      deleteSecret(c.db, row.id);
      c.db.run('UPDATE agents SET connector_id = NULL WHERE connector_id = ?', row.id);
      c.db.run('DELETE FROM connectors WHERE id = ?', row.id);
    });
    audit(c.db, { actor: c.actor, action: 'connector_dipadam', entity: 'connector', entity_id: row.id, detail: { provider: row.provider } });
    return { ok: true };
  });

  // ---------- Tetapan ----------
  r.get('/api/settings', (c) => {
    const org = c.db.setting('org', {});
    const basic = { org: { name: org.name, language: org.language }, demo_mode: c.db.setting('demo_mode', true) };
    if (!can(c, 'urus_tetapan')) return basic;
    return { org, demo_mode: basic.demo_mode, confidence_threshold: c.db.setting('confidence_threshold', 0.8), org_monthly_cost_limit: c.db.setting('org_monthly_cost_limit', 0), secured: c.session.secured };
  });
  r.put('/api/settings', need('urus_tetapan'), (c) => {
    const b = c.body;
    const changed = [];
    if (b.org) {
      const cur = c.db.setting('org', {});
      c.db.setSetting('org', { ...cur, name: str(b.org.name, 80) || cur.name, ceo_name: str(b.org.ceo_name, 40) || cur.ceo_name, language: ['ms', 'en'].includes(b.org.language) ? b.org.language : cur.language, timezone: str(b.org.timezone, 60) || cur.timezone });
      changed.push('org');
    }
    if ('demo_mode' in b) { c.db.setSetting('demo_mode', Boolean(b.demo_mode)); changed.push('demo_mode'); }
    if ('confidence_threshold' in b) { c.db.setSetting('confidence_threshold', Math.min(1, Math.max(0, num(b.confidence_threshold, 0.8)))); changed.push('confidence_threshold'); }
    if ('org_monthly_cost_limit' in b) { c.db.setSetting('org_monthly_cost_limit', Math.max(0, num(b.org_monthly_cost_limit, 0))); changed.push('org_monthly_cost_limit'); }
    audit(c.db, { actor: c.actor, action: 'tetapan_diubah', entity: 'tetapan', detail: { fields: changed } });
    return { ok: true };
  });

  // ---------- Audit ----------
  r.get('/api/audit', need('lihat_audit'), (c) => {
    const where = [];
    const p = [];
    if (c.query.outcome) { where.push('outcome = ?'); p.push(c.query.outcome); }
    if (c.query.q) { where.push('(action LIKE ? OR actor LIKE ? OR reason LIKE ? OR entity LIKE ?)'); const q = `%${c.query.q}%`; p.push(q, q, q, q); }
    const limit = Math.min(500, Math.max(1, num(c.query.limit, 200)));
    return c.db.all(`SELECT * FROM audit ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ${limit}`, ...p).map((a) => parseJson(a, ['detail']));
  });

  return { router: r, TaskError };
}
