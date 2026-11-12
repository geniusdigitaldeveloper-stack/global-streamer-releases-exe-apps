// Kitaran hayat tugasan dan kelulusan.
import { now, parseJson } from './db.js';
import { audit } from './audit.js';
import { evaluateAction } from './policy.js';
import { resolveGenerator } from './integrations/index.js';

export const TASK_STATUSES = ['baharu', 'diagihkan', 'berjalan', 'dijeda', 'menunggu_kelulusan', 'ditahan', 'tindakan_manual', 'selesai', 'ditolak', 'ditutup'];
// Tindakan yang memberi kesan di luar aplikasi. Tiada pelaksana automatik buat masa ini → aliran manual.
const EXTERNAL = new Set(['jadual_kandungan', 'terbit_kandungan', 'deploy', 'komunikasi_luar', 'kewangan', 'padam_data', 'ubah_akses']);

// Alat kerja. `ai` dipanggil terus melalui connector; yang lain ialah alat luar tanpa API yang disambungkan,
// jadi aplikasi menyediakan brief kerja dan menunggu pelaksanaan manual (tidak berpura-pura telah menjalankannya).
export const TOOLS = {
  ai: { label: 'Penyedia AI (API)', how: '' },
  claude_code: { label: 'Claude Code', how: 'Cara jalankan: buka repo berkaitan, mulakan Claude Code (`claude`), tampal brief ini, semak hasil, kemudian tandakan tugasan selesai.' },
  flow: { label: 'Flow AI', how: 'Cara jalankan: buka Flow AI, guna prompt di atas syot demi syot, muat turun hasil, kemudian tandakan tugasan selesai.' },
  manual: { label: 'Aliran manual', how: 'Laksanakan secara manual, kemudian tandakan tugasan selesai.' },
};

export class TaskError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const getAgent = (db, id) => parseJson(db.get('SELECT * FROM agents WHERE id = ?', id), ['skills', 'allowed_tools', 'allowed_actions']);
export function getTask(db, id) {
  const t = db.get('SELECT * FROM tasks WHERE id = ?', id);
  if (!t) throw new TaskError('Tugasan tidak ditemui.', 404);
  return t;
}
function event(db, taskId, actor, ev, detail = '') {
  db.insert('task_events', { task_id: taskId, ts: now(), actor, event: ev, detail });
}
function setStatus(db, task, status, extra = {}) {
  db.update('tasks', task.id, { status, updated_at: now(), ...extra });
}

function usageFor(db, agent) {
  const day = new Date().toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  return {
    tasksToday: db.get("SELECT COUNT(*) n FROM task_events WHERE event = 'dilaksanakan' AND ts LIKE ? AND task_id IN (SELECT id FROM tasks WHERE agent_id = ?)", `${day}%`, agent?.id ?? -1).n,
    agentCostMonth: db.get('SELECT COALESCE(SUM(cost),0) c FROM usage WHERE agent_id = ? AND is_simulation = 0 AND ts LIKE ?', agent?.id ?? -1, `${month}%`).c,
    orgCostMonth: db.get('SELECT COALESCE(SUM(cost),0) c FROM usage WHERE is_simulation = 0 AND ts LIKE ?', `${month}%`).c,
  };
}

export function evaluateTask(db, task, confidence = null) {
  const agent = task.agent_id ? getAgent(db, task.agent_id) : null;
  const policy = db.get('SELECT * FROM policies WHERE action_type = ?', task.action_type);
  const platform = task.platform_id ? db.get('SELECT * FROM platforms WHERE id = ?', task.platform_id) : null;
  const platformPerm = platform && agent ? db.get('SELECT * FROM agent_platforms WHERE agent_id = ? AND platform_id = ?', agent.id, platform.id) : null;
  const verdict = evaluateAction({
    agent, task, policy, platform, platformPerm, confidence, usage: usageFor(db, agent),
    settings: { confidenceThreshold: db.setting('confidence_threshold', 0.8), orgMonthlyCostLimit: db.setting('org_monthly_cost_limit', 0) },
  });
  return { verdict, agent, policy };
}

// Agent cuba melaksanakan tugasan. Polisi menentukan hasilnya.
export function runTask(db, id, actor, { confidence = null } = {}) {
  const task = getTask(db, id);
  if (!['baharu', 'diagihkan', 'ditahan'].includes(task.status)) throw new TaskError(`Tugasan berstatus "${task.status}" tidak boleh dimulakan.`);
  const { verdict, agent, policy } = evaluateTask(db, task, confidence);
  const reason = verdict.reasons.map((x) => x.text).join(' ');
  const base = { actor: agent?.name || actor, entity: 'tugasan', entity_id: id, is_demo: task.is_demo, detail: { action_type: task.action_type, risk: verdict.risk, codes: verdict.reasons.map((x) => x.code), confidence, dimulakan_oleh: actor } };

  if (verdict.decision === 'tolak' || verdict.decision === 'tahan') {
    const outcome = verdict.decision === 'tolak' ? 'ditolak' : 'ditahan';
    setStatus(db, task, 'ditahan', { hold_reason: reason });
    event(db, id, 'polisi', outcome, reason);
    audit(db, { ...base, action: 'tindakan_agent', outcome, reason });
    return { decision: verdict.decision, reasons: verdict.reasons };
  }
  if (verdict.decision === 'kelulusan') {
    const approvalId = db.insert('approvals', {
      task_id: id, agent_id: task.agent_id, action_type: task.action_type,
      proposal: `${policy?.label || task.action_type}: ${task.title}${task.description ? ` — ${task.description}` : ''}`,
      context: [task.success_criteria && `Kriteria kejayaan: ${task.success_criteria}`, confidence != null && `Keyakinan agent: ${Math.round(confidence * 100)}%`].filter(Boolean).join('\n'),
      evidence: task.evidence || '', risk: verdict.risk, reasons: JSON.stringify(verdict.reasons), is_demo: task.is_demo, created_at: now(),
    });
    setStatus(db, task, 'menunggu_kelulusan', { hold_reason: '' });
    event(db, id, 'polisi', 'minta_kelulusan', reason);
    audit(db, { ...base, action: 'minta_kelulusan', outcome: 'ditahan', reason, detail: { ...base.detail, approval_id: approvalId } });
    return { decision: 'kelulusan', reasons: verdict.reasons, approval_id: approvalId };
  }
  audit(db, { ...base, action: 'tindakan_agent', outcome: 'dibenarkan', reason });
  return { decision: 'benar', reasons: verdict.reasons, execution: execute(db, getTask(db, id), agent, actor) };
}

// Pelaksanaan selepas dibenarkan polisi atau diluluskan CEO.
function execute(db, task, agent, actor, approvedProposal = null) {
  event(db, task.id, agent?.name || actor, 'dilaksanakan', approvedProposal ? 'Selepas kelulusan.' : 'Dibenarkan oleh polisi.');
  if (EXTERNAL.has(task.action_type)) {
    const note = `Diluluskan. Tiada connector pelaksanaan aktif untuk tindakan ini — laksanakan secara manual, kemudian tandakan selesai.${approvedProposal ? `\n\nCadangan diluluskan:\n${approvedProposal}` : ''}`;
    setStatus(db, task, 'tindakan_manual', { result: note, result_is_simulation: 0, hold_reason: '' });
    event(db, task.id, 'sistem', 'tindakan_manual', 'Menunggu pelaksanaan manual.');
    return { mode: 'manual' };
  }
  // Jenis kerja menentukan alat AI: penyedia/model khusus, atau alat luar (Claude Code, Flow AI).
  const wt = db.get('SELECT * FROM work_types WHERE key = ?', task.work_type || 'umum');
  const external = wt && wt.tool !== 'ai' ? TOOLS[wt.tool] || TOOLS.manual : null;
  const worker = wt?.connector_id ? { ...agent, connector_id: wt.connector_id, model: wt.model || '' } : agent;
  const repos = db.setting('repos', []);
  const repoText = repos.length ? `Repo tersedia:\n${repos.map((r) => `- ${r.name} (${r.location}): ${r.purpose}`).join('\n')}` : '';
  const generator = resolveGenerator(db, worker);
  if (!generator) {
    if (external) {
      const brief = [`[TEMPLAT — bukan hasil AI] Brief untuk ${external.label}`, `Tugasan: ${task.title}`, task.description, task.success_criteria && `Kriteria kejayaan: ${task.success_criteria}`, wt.guidance, repoText, external.how].filter(Boolean).join('\n\n');
      setStatus(db, task, 'tindakan_manual', { hold_reason: '', result: brief, result_is_simulation: 0 });
      event(db, task.id, 'sistem', 'tindakan_manual', `Brief templat disediakan untuk ${external.label}.`);
      return { mode: 'manual', tool: external.label };
    }
    setStatus(db, task, 'berjalan', {
      hold_reason: '', result_is_simulation: 1,
      result: '[SIMULASI] Tiada penyedia AI aktif untuk kerja ini. Tiada kerja AI sebenar dilaksanakan — status ini hanya menunjukkan aliran tugasan.',
    });
    db.insert('usage', { agent_id: agent?.id ?? null, task_id: task.id, ts: now(), is_simulation: 1 });
    event(db, task.id, 'sistem', 'simulasi', 'Dijalankan sebagai simulasi (tiada penyedia AI aktif).');
    return { mode: 'simulasi' };
  }
  setStatus(db, task, 'berjalan', { hold_reason: '', result: '', result_is_simulation: 0 });
  const prompt = [`Tugasan: ${task.title}`, task.description && `Butiran: ${task.description}`, task.success_criteria && `Kriteria kejayaan: ${task.success_criteria}`,
    task.evidence && `Bukti/rujukan: ${task.evidence}`, approvedProposal && `Cadangan yang diluluskan: ${approvedProposal}`,
    wt?.guidance && `Panduan jenis kerja (${wt.label}): ${wt.guidance}`, (external || wt?.guidance) && repoText,
    external ? `Output anda ialah BRIEF KERJA untuk dijalankan oleh manusia dalam ${external.label}; anda sendiri tidak menjalankannya.` : '',
    'Hasilkan output kerja sahaja. Jangan dakwa telah menerbit, menghantar, menyunting fail atau mengubah apa-apa di luar jawapan ini.'].filter(Boolean).join('\n\n');
  // Dijalankan di latar; UI memantau status tugasan.
  generator.run({ model: worker.model, system: agent.instructions || `Anda ialah ${agent.name}.`, prompt }).then((out) => {
    db.insert('usage', { agent_id: agent.id, task_id: task.id, ts: now(), tokens_in: out.tokens_in, tokens_out: out.tokens_out, cost: out.cost, is_simulation: 0 });
    const current = getTask(db, task.id);
    const next = current.status !== 'berjalan' ? {} : { status: external ? 'tindakan_manual' : 'selesai' };
    const text = external ? `Brief untuk ${external.label} (dijana oleh ${generator.name})\n\n${out.text}\n\n${external.how}` : out.text;
    db.update('tasks', task.id, { result: text, result_is_simulation: 0, updated_at: now(), ...next });
    event(db, task.id, agent.name, 'hasil_ai', `Hasil dijana oleh ${generator.name} (${out.model}).${external ? ` Menunggu pelaksanaan dalam ${external.label}.` : ''}`);
    audit(db, { actor: agent.name, action: 'jana_ai', entity: 'tugasan', entity_id: task.id, detail: { model: out.model, tokens_in: out.tokens_in, tokens_out: out.tokens_out, cost: out.cost, work_type: wt?.key } });
  }).catch((e) => {
    db.update('tasks', task.id, { status: 'ditahan', hold_reason: `Ralat penyedia AI: ${e.message}`, updated_at: now() });
    event(db, task.id, 'sistem', 'ralat', e.message);
    audit(db, { actor: agent.name, action: 'jana_ai', entity: 'tugasan', entity_id: task.id, outcome: 'gagal', reason: e.message });
  });
  return { mode: 'ai', provider: generator.name, tool: external?.label };
}

const TRANSITIONS = {
  pause: { from: ['berjalan'], to: 'dijeda', event: 'dijeda' },
  resume: { from: ['dijeda'], to: 'berjalan', event: 'diteruskan' },
  complete: { from: ['berjalan', 'tindakan_manual'], to: 'selesai', event: 'selesai' },
  close: { from: TASK_STATUSES.filter((s) => s !== 'ditutup'), to: 'ditutup', event: 'ditutup' },
};

export function transitionTask(db, id, action, actor, note = '') {
  const t = TRANSITIONS[action];
  const task = getTask(db, id);
  if (!t) throw new TaskError('Tindakan tidak dikenali.');
  if (!t.from.includes(task.status)) throw new TaskError(`Tugasan berstatus "${task.status}" tidak boleh ${t.event}.`);
  const extra = action === 'close' ? { closed_at: now() } : {};
  setStatus(db, task, t.to, extra);
  if (action === 'close')
    db.run("UPDATE approvals SET status = 'dibatalkan', decided_by = ?, decided_at = ?, decision_note = 'Tugasan ditutup.' WHERE task_id = ? AND status IN ('menunggu','maklumat_diminta')", actor, now(), id);
  event(db, id, actor, t.event, note);
  audit(db, { actor, action: `tugasan_${t.event}`, entity: 'tugasan', entity_id: id, reason: note, is_demo: task.is_demo });
  return getTask(db, id);
}

export function assignTask(db, id, agentId, actor) {
  const task = getTask(db, id);
  if (!['baharu', 'diagihkan', 'ditahan'].includes(task.status)) throw new TaskError(`Tugasan berstatus "${task.status}" tidak boleh diagihkan semula.`);
  const agent = agentId ? getAgent(db, agentId) : null;
  if (agentId && !agent) throw new TaskError('Agent tidak ditemui.', 404);
  setStatus(db, task, agent ? 'diagihkan' : 'baharu', { agent_id: agent?.id ?? null, hold_reason: '' });
  event(db, id, actor, 'diagihkan', agent ? `Kepada ${agent.name}.` : 'Agihan dibuang.');
  audit(db, { actor, action: 'tugasan_diagihkan', entity: 'tugasan', entity_id: id, detail: { agent: agent?.name ?? null }, is_demo: task.is_demo });
  return getTask(db, id);
}

export function decideApproval(db, id, actor, { decision, note = '', proposal = null }) {
  const a = db.get('SELECT * FROM approvals WHERE id = ?', id);
  if (!a) throw new TaskError('Kelulusan tidak ditemui.', 404);
  if (!['menunggu', 'maklumat_diminta'].includes(a.status)) throw new TaskError('Kelulusan ini telah diputuskan.');
  if (!['lulus', 'sunting', 'tolak', 'minta_maklumat'].includes(decision)) throw new TaskError('Keputusan tidak sah.');
  if (decision === 'sunting' && !String(proposal || '').trim()) throw new TaskError('Cadangan yang disunting diperlukan.');
  if ((decision === 'tolak' || decision === 'minta_maklumat') && !note.trim()) throw new TaskError('Sila nyatakan sebab atau maklumat yang diperlukan.');
  const task = getTask(db, a.task_id);
  const base = { actor, entity: 'kelulusan', entity_id: id, reason: note, is_demo: a.is_demo, detail: { task_id: a.task_id, action_type: a.action_type, risk: a.risk } };

  if (decision === 'minta_maklumat') {
    db.update('approvals', id, { status: 'maklumat_diminta', decision_note: note });
    event(db, task.id, actor, 'maklumat_diminta', note);
    audit(db, { ...base, action: 'kelulusan_minta_maklumat', outcome: 'ditahan' });
    return { status: 'maklumat_diminta' };
  }
  if (decision === 'tolak') {
    db.update('approvals', id, { status: 'ditolak', decision_note: note, decided_by: actor, decided_at: now() });
    setStatus(db, task, 'ditolak', { hold_reason: `Ditolak oleh ${actor}: ${note}` });
    event(db, task.id, actor, 'kelulusan_ditolak', note);
    audit(db, { ...base, action: 'kelulusan_ditolak', outcome: 'ditolak' });
    return { status: 'ditolak' };
  }
  const finalProposal = decision === 'sunting' ? String(proposal).trim() : a.proposal;
  db.update('approvals', id, { status: decision === 'sunting' ? 'diluluskan_disunting' : 'diluluskan', proposal: finalProposal, decision_note: note, decided_by: actor, decided_at: now() });
  event(db, task.id, actor, decision === 'sunting' ? 'diluluskan_dengan_suntingan' : 'diluluskan', note);
  audit(db, { ...base, action: decision === 'sunting' ? 'kelulusan_disunting' : 'kelulusan_diluluskan', detail: { ...base.detail, disunting: decision === 'sunting' } });
  // Kelulusan tidak mengatasi kebenaran: semak semula sekatan keras sebelum melaksanakan.
  const { verdict, agent } = evaluateTask(db, task);
  if (verdict.decision === 'tolak' || verdict.decision === 'tahan') {
    const reason = verdict.reasons.map((x) => x.text).join(' ');
    setStatus(db, task, 'ditahan', { hold_reason: reason });
    event(db, task.id, 'polisi', 'ditahan', reason);
    audit(db, { actor: 'polisi', action: 'tindakan_agent', entity: 'tugasan', entity_id: task.id, outcome: verdict.decision === 'tolak' ? 'ditolak' : 'ditahan', reason, is_demo: task.is_demo });
    return { status: 'diluluskan', held: true, reasons: verdict.reasons };
  }
  return { status: 'diluluskan', execution: execute(db, task, agent, actor, finalProposal) };
}

export function addApprovalInfo(db, id, actor, info) {
  const a = db.get('SELECT * FROM approvals WHERE id = ?', id);
  if (!a) throw new TaskError('Kelulusan tidak ditemui.', 404);
  if (a.status !== 'maklumat_diminta') throw new TaskError('Tiada maklumat diminta untuk kelulusan ini.');
  if (!String(info || '').trim()) throw new TaskError('Maklumat diperlukan.');
  db.update('approvals', id, { status: 'menunggu', context: `${a.context}\n\nMaklumat tambahan (${actor}): ${info}`.trim() });
  event(db, a.task_id, actor, 'maklumat_diberi', info);
  audit(db, { actor, action: 'kelulusan_maklumat_diberi', entity: 'kelulusan', entity_id: id, is_demo: a.is_demo });
}
