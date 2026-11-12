// Enjin polisi kelulusan. Fungsi tulen (tiada I/O) supaya mudah diuji.
//
// Susunan penilaian — keyakinan agent TIDAK PERNAH mengatasi mana-mana semakan di atasnya:
//   1. TOLAK   : agent tidak aktif, tiada kebenaran tindakan/platform, polisi menyekat.
//   2. TAHAN   : had penggunaan atau had kos dicapai.
//   3. KELULUSAN: polisi memerlukan kelulusan, arahan tidak jelas, bukti tidak cukup, luar skop,
//                 percanggahan polisi, kesan penting, tiada kriteria kejayaan, keyakinan rendah.
//   4. BENAR   : tugasan rutin yang jelas, dibenarkan dan memenuhi kriteria.

export const PLATFORM_PERMISSION = {
  analitik: 'analitik', draf_kandungan: 'draf', jadual_kandungan: 'jadual', terbit_kandungan: 'terbit',
};
const HIGH_RISK = new Set(['deploy', 'kewangan', 'padam_data', 'ubah_akses']);

export function evaluateAction({ agent, task, policy, platform = null, platformPerm = null, usage = {}, settings = {}, confidence = null }) {
  const deny = [];
  const hold = [];
  const ask = [];
  const label = policy?.label || task.action_type;

  if (!agent) deny.push(r('tiada_agent', 'Tugasan belum diagihkan kepada mana-mana agent.'));
  else {
    if (agent.status !== 'aktif') deny.push(r('agent_tidak_aktif', `${agent.name} tidak aktif.`));
    if (!(agent.allowed_actions || []).includes(task.action_type))
      deny.push(r('tiada_kebenaran', `${agent.name} tidak mempunyai kebenaran untuk "${label}".`));
  }
  if (!policy) deny.push(r('tiada_polisi', `Tiada polisi untuk jenis tindakan "${task.action_type}".`));
  else if (policy.mode === 'sekat') deny.push(r('polisi_sekat', `Polisi menyekat "${label}".`));

  const need = PLATFORM_PERMISSION[task.action_type];
  if (platform) {
    if (!platform.enabled) deny.push(r('platform_tidak_dibenarkan', `${platform.name} tiada dalam senarai platform yang dibenarkan.`));
    else if (need && !(platformPerm && platformPerm[need]))
      deny.push(r('tiada_kebenaran_platform', `${agent?.name || 'Agent'} tiada kebenaran "${need}" untuk ${platform.name}.`));
  } else if (need && need !== 'analitik' && need !== 'draf') {
    ask.push(r('platform_tidak_dinyatakan', 'Platform sasaran tidak dinyatakan.'));
  }

  if (agent) {
    if (agent.daily_task_limit > 0 && (usage.tasksToday ?? 0) >= agent.daily_task_limit)
      hold.push(r('had_tugasan', `Had ${agent.daily_task_limit} tugasan sehari untuk ${agent.name} telah dicapai.`));
    if (agent.monthly_cost_limit > 0 && (usage.agentCostMonth ?? 0) >= agent.monthly_cost_limit)
      hold.push(r('had_kos_agent', `Had kos bulanan ${agent.name} telah dicapai.`));
  }
  if (settings.orgMonthlyCostLimit > 0 && (usage.orgCostMonth ?? 0) >= settings.orgMonthlyCostLimit)
    hold.push(r('had_kos_organisasi', 'Had kos bulanan organisasi telah dicapai.'));

  if (policy && (policy.mode === 'kelulusan' || policy.controlled))
    ask.push(r('polisi_kelulusan', `Polisi menetapkan "${label}" memerlukan kelulusan.`));
  if (!task.clear_instructions) ask.push(r('arahan_tidak_jelas', 'Arahan tidak jelas.'));
  if (policy?.controlled && !String(task.evidence || '').trim()) ask.push(r('bukti_tidak_cukup', 'Bukti tidak mencukupi.'));
  if (agent && task.department_id && agent.department_id && task.department_id !== agent.department_id)
    ask.push(r('luar_skop', `Tugasan di luar skop jabatan ${agent.name}.`));
  if (task.policy_conflict) ask.push(r('percanggahan_polisi', 'Terdapat percanggahan polisi yang dilaporkan.'));
  if (task.impact === 'penting') ask.push(r('kesan_penting', 'Tindakan mempunyai kesan penting.'));
  if (!String(task.success_criteria || '').trim()) ask.push(r('tiada_kriteria', 'Kriteria kejayaan belum dikonfigurasi.'));
  const threshold = settings.confidenceThreshold ?? 0.8;
  if (confidence != null && confidence < threshold)
    ask.push(r('keyakinan_rendah', `Keyakinan agent (${Math.round(confidence * 100)}%) di bawah ambang ${Math.round(threshold * 100)}%.`));

  const risk = HIGH_RISK.has(task.action_type) || task.impact === 'penting' ? 'tinggi'
    : policy?.controlled || ask.length > 1 ? 'sederhana' : 'rendah';

  if (deny.length) return { decision: 'tolak', reasons: deny, risk };
  if (hold.length) return { decision: 'tahan', reasons: hold, risk };
  if (ask.length) return { decision: 'kelulusan', reasons: ask, risk };
  return { decision: 'benar', reasons: [r('rutin_dibenarkan', 'Tugasan rutin yang jelas, dibenarkan dan memenuhi kriteria.')], risk };
}

const r = (code, text) => ({ code, text });
