import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

process.env.GD_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-test-'));
process.env.GD_DB_PATH = ':memory:';
delete process.env.GD_CEO_PIN;
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'METRICOOL_API_TOKEN']) delete process.env[k];
const { createApp } = await import('../src/index.js');

const { server } = createApp();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

async function client(role) {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
  const jar = res.headers.get('set-cookie').split(';')[0];
  return async (method, url, body) => {
    const r = await fetch(base + url, { method, headers: { Cookie: jar, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json() };
  };
}
const ceo = await client('ceo');
const pelawat = await client('pelawat');

test('tanpa sesi → 401', async () => {
  assert.equal((await fetch(`${base}/api/agents`)).status, 401);
});
test('roster seed termasuk SALWANI dan 13 agent', async () => {
  const { body } = await ceo('GET', '/api/agents');
  assert.ok(body.find((a) => a.name === 'SALWANI' && a.kind === 'staf'));
  assert.equal(body.filter((a) => a.kind === 'agent').length, 13);
});
test('pelawat tidak boleh urus staf atau lihat arahan agent', async () => {
  assert.equal((await pelawat('POST', '/api/agents', { name: 'X' })).status, 403);
  const { body } = await pelawat('GET', '/api/agents');
  assert.equal(body[0].instructions, undefined);
  assert.equal((await pelawat('GET', '/api/audit')).status, 403);
});
test('akses ruang: pelawat tidak boleh masuk suite CEO; CEO boleh', async () => {
  const room = (w, k) => w.body.rooms.find((r) => r.key === k);
  const wp = await pelawat('GET', '/api/world');
  const wc = await ceo('GET', '/api/world');
  for (const k of ['bilik_tidur', 'suite_rehat', 'pejabat_ceo']) { assert.equal(room(wp, k).can_enter, false); assert.equal(room(wc, k).can_enter, true); }
  assert.equal(room(wp, 'lobi').can_enter, true);
});
test('bilik tidur peribadi tidak boleh dibuka kepada peranan lain', async () => {
  const rooms = (await ceo('GET', '/api/rooms')).body;
  const roles = (await ceo('GET', '/api/roles')).body.roles;
  const bed = rooms.find((r) => r.key === 'bilik_tidur');
  const r = await ceo('PUT', `/api/rooms/${bed.id}/access`, { role_ids: roles.map((x) => x.id) });
  assert.equal(r.status, 400);
});
test('CRUD agent', async () => {
  const c = await ceo('POST', '/api/agents', { name: 'Agent Ujian', kind: 'agent', allowed_actions: ['rutin', 'tidak_wujud'] });
  assert.equal(c.status, 200);
  assert.deepEqual(c.body.allowed_actions, ['rutin']);
  const u = await ceo('PUT', `/api/agents/${c.body.id}`, { status: 'tidak_aktif', skills: 'a, b' });
  assert.equal(u.body.status, 'tidak_aktif');
  assert.deepEqual(u.body.skills, ['a', 'b']);
  assert.equal((await ceo('DELETE', `/api/agents/${c.body.id}`)).status, 200);
});
test('tugasan rutin: dibenarkan dan dijalankan sebagai SIMULASI tanpa penyedia AI', async () => {
  const agents = (await ceo('GET', '/api/agents')).body;
  const hakim = agents.find((a) => a.name === 'Hakim');
  const t = await ceo('POST', '/api/tasks', { title: 'Laporan', action_type: 'rutin', agent_id: hakim.id, department_id: hakim.department_id, success_criteria: 'satu halaman' });
  assert.equal(t.body.status, 'diagihkan');
  const run = await ceo('POST', `/api/tasks/${t.body.id}/run`, { confidence: 0.9 });
  assert.equal(run.body.decision, 'benar');
  assert.equal(run.body.execution.mode, 'simulasi');
  const after = (await ceo('GET', `/api/tasks/${t.body.id}`)).body;
  assert.equal(after.status, 'berjalan');
  assert.equal(after.result_is_simulation, 1);
  assert.equal((await ceo('POST', `/api/tasks/${t.body.id}/pause`, {})).body.status, 'dijeda');
  assert.equal((await ceo('POST', `/api/tasks/${t.body.id}/resume`, {})).body.status, 'berjalan');
  assert.equal((await ceo('POST', `/api/tasks/${t.body.id}/close`, {})).body.status, 'ditutup');
});
test('tindakan kewangan: perlu kelulusan; lulus → tindakan manual; audit direkod', async () => {
  const agents = (await ceo('GET', '/api/agents')).body;
  const rohana = agents.find((a) => a.name === 'Rohana');
  const t = await ceo('POST', '/api/tasks', { title: 'Bayar', action_type: 'kewangan', agent_id: rohana.id, department_id: rohana.department_id, evidence: 'invois', success_criteria: 'dibayar' });
  const run = await ceo('POST', `/api/tasks/${t.body.id}/run`, { confidence: 1 });
  assert.equal(run.body.decision, 'kelulusan');
  const queue = (await ceo('GET', '/api/approvals')).body;
  const ap = queue.find((a) => a.id === run.body.approval_id);
  assert.equal(ap.risk, 'tinggi');
  assert.equal((await ceo('POST', `/api/approvals/${ap.id}/decide`, { decision: 'tolak' })).status, 400); // sebab diperlukan
  const d = await ceo('POST', `/api/approvals/${ap.id}/decide`, { decision: 'sunting', proposal: 'Bayar separuh dahulu', note: 'ok' });
  assert.equal(d.body.execution.mode, 'manual');
  assert.equal((await ceo('GET', `/api/tasks/${t.body.id}`)).body.status, 'tindakan_manual');
  const log = (await ceo('GET', '/api/audit?q=kelulusan_disunting')).body;
  assert.ok(log.length >= 1);
});
test('agent tanpa kebenaran: ditolak dengan sebab direkod', async () => {
  const agents = (await ceo('GET', '/api/agents')).body;
  const nadia = agents.find((a) => a.name === 'Nadia');
  const t = await ceo('POST', '/api/tasks', { title: 'Deploy', action_type: 'deploy', agent_id: nadia.id });
  const run = await ceo('POST', `/api/tasks/${t.body.id}/run`, { confidence: 1 });
  assert.equal(run.body.decision, 'tolak');
  const after = (await ceo('GET', `/api/tasks/${t.body.id}`)).body;
  assert.equal(after.status, 'ditahan');
  assert.match(after.hold_reason, /tidak mempunyai kebenaran/);
  assert.ok((await ceo('GET', '/api/audit?outcome=ditolak')).body.some((a) => a.entity_id === String(t.body.id)));
});
test('polisi terkawal tidak boleh ditetapkan automatik', async () => {
  assert.equal((await ceo('PUT', '/api/policies/deploy', { mode: 'auto' })).status, 400);
  assert.equal((await ceo('PUT', '/api/policies/deploy', { mode: 'sekat' })).status, 200);
});
test('rahsia: disimpan tersulit, tidak pernah dipulangkan; status jujur', async () => {
  const secret = 'sk-ant-RAHSIA-UJIAN-1234567890';
  let { body } = await ceo('GET', '/api/connectors');
  const c = body.connectors.find((x) => x.provider === 'metricool');
  assert.equal(c.status, 'belum_dikonfigurasi');
  const saved = await ceo('POST', `/api/connectors/${c.id}/secret`, { value: secret });
  assert.equal(saved.body.secret.has_secret, true);
  assert.equal(saved.body.status, 'belum_diuji'); // bukan "aktif" sehingga ujian berjaya
  body = (await ceo('GET', '/api/connectors')).body;
  assert.ok(!JSON.stringify(body).includes(secret));
  assert.ok(!JSON.stringify((await ceo('GET', '/api/audit')).body).includes(secret));
  const test1 = await ceo('POST', `/api/connectors/${c.id}/test`, {});
  assert.equal(test1.body.result.ok, false); // userId belum diisi → tiada kejayaan palsu
  assert.equal(test1.body.connector.status, 'ralat');
  assert.equal((await ceo('DELETE', `/api/connectors/${c.id}/secret`)).body.status, 'belum_dikonfigurasi');
});
test('allowlist platform dan kebenaran agent', async () => {
  const plats = (await ceo('GET', '/api/platforms')).body;
  const li = plats.find((p) => p.key === 'linkedin');
  assert.equal(li.enabled, 0);
  assert.equal((await ceo('PUT', `/api/platforms/${li.id}`, { enabled: true })).status, 200);
  const aina = (await ceo('GET', '/api/agents')).body.find((a) => a.name === 'Aina');
  await ceo('PUT', `/api/agents/${aina.id}/platforms`, { platforms: [{ platform_id: li.id, analitik: true, draf: true }] });
  const ap = (await ceo('GET', `/api/agents/${aina.id}/platforms`)).body.find((p) => p.platform_id === li.id);
  assert.deepEqual([ap.analitik, ap.draf, ap.jadual, ap.terbit], [1, 1, 0, 0]);
});
test('jenis kerja: suntingan video → brief Claude Code (templat, tidak dipalsukan sebagai hasil AI)', async () => {
  const wt = (await ceo('GET', '/api/work-types')).body;
  assert.equal(wt.work_types.find((w) => w.key === 'suntingan_video').tool, 'claude_code');
  assert.equal(wt.work_types.find((w) => w.key === 'poster').connector_name, 'OpenAI (GPT)');
  assert.equal(wt.work_types.find((w) => w.key === 'laman_web').connector_name, 'Google Gemini');
  const nadia = (await ceo('GET', '/api/agents')).body.find((a) => a.name === 'Nadia');
  const t = await ceo('POST', '/api/tasks', { title: 'Sunting video produk', work_type: 'suntingan_video', action_type: 'rutin', agent_id: nadia.id, department_id: nadia.department_id, success_criteria: 'video 30 saat' });
  const run = await ceo('POST', `/api/tasks/${t.body.id}/run`, {});
  assert.equal(run.body.execution.mode, 'manual');
  const after = (await ceo('GET', `/api/tasks/${t.body.id}`)).body;
  assert.equal(after.status, 'tindakan_manual');
  assert.match(after.result, /TEMPLAT/);
  assert.match(after.result, /video-auto-pipeline/);
});
test('dashboard memulangkan ringkasan', async () => {
  const { body } = await ceo('GET', '/api/dashboard');
  assert.ok(body.agents >= 13 && body.approvals_pending >= 1 && body.alerts.length >= 1);
});
