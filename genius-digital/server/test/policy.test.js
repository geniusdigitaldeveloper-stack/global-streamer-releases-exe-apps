import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAction } from '../src/policy.js';

const agent = { id: 1, name: 'Ujian', status: 'aktif', department_id: 1, allowed_actions: ['rutin', 'terbit_kandungan'], daily_task_limit: 5, monthly_cost_limit: 10 };
const rutin = { action_type: 'rutin', label: 'Tugasan rutin', mode: 'auto', controlled: 0 };
const terbit = { action_type: 'terbit_kandungan', label: 'Terbitkan kandungan', mode: 'kelulusan', controlled: 1 };
const task = (o = {}) => ({ action_type: 'rutin', clear_instructions: 1, success_criteria: 'ada', evidence: '', department_id: 1, impact: 'biasa', policy_conflict: 0, ...o });
const codes = (v) => v.reasons.map((r) => r.code);

test('tugasan rutin yang jelas dibenarkan', () => {
  assert.equal(evaluateAction({ agent, task: task(), policy: rutin, confidence: 0.95 }).decision, 'benar');
});
test('arahan tidak jelas, luar skop, percanggahan polisi, kesan penting → kelulusan', () => {
  for (const [o, code] of [[{ clear_instructions: 0 }, 'arahan_tidak_jelas'], [{ department_id: 2 }, 'luar_skop'], [{ policy_conflict: 1 }, 'percanggahan_polisi'], [{ impact: 'penting' }, 'kesan_penting'], [{ success_criteria: '' }, 'tiada_kriteria']]) {
    const v = evaluateAction({ agent, task: task(o), policy: rutin, confidence: 1 });
    assert.equal(v.decision, 'kelulusan');
    assert.ok(codes(v).includes(code), code);
  }
});
test('keyakinan rendah → kelulusan', () => {
  assert.equal(evaluateAction({ agent, task: task(), policy: rutin, confidence: 0.5 }).decision, 'kelulusan');
});
test('keyakinan tinggi tidak mengatasi polisi kelulusan', () => {
  const v = evaluateAction({ agent, task: task({ action_type: 'terbit_kandungan', evidence: 'draf' }), policy: terbit, platform: { name: 'IG', enabled: 1 }, platformPerm: { terbit: 1 }, confidence: 1 });
  assert.equal(v.decision, 'kelulusan');
  assert.ok(codes(v).includes('polisi_kelulusan'));
});
test('tindakan terkawal tanpa bukti menandakan bukti tidak cukup', () => {
  const v = evaluateAction({ agent, task: task({ action_type: 'terbit_kandungan' }), policy: terbit, platform: { name: 'IG', enabled: 1 }, platformPerm: { terbit: 1 } });
  assert.ok(codes(v).includes('bukti_tidak_cukup'));
});
test('keyakinan tinggi tidak mengatasi kebenaran', () => {
  const v = evaluateAction({ agent, task: task({ action_type: 'kewangan' }), policy: { label: 'Kewangan', mode: 'kelulusan', controlled: 1 }, confidence: 1 });
  assert.equal(v.decision, 'tolak');
  assert.ok(codes(v).includes('tiada_kebenaran'));
});
test('platform di luar allowlist atau tanpa kebenaran → tolak', () => {
  const t = task({ action_type: 'terbit_kandungan', evidence: 'x' });
  assert.equal(evaluateAction({ agent, task: t, policy: terbit, platform: { name: 'X', enabled: 0 }, platformPerm: { terbit: 1 } }).decision, 'tolak');
  assert.equal(evaluateAction({ agent, task: t, policy: terbit, platform: { name: 'IG', enabled: 1 }, platformPerm: { terbit: 0, draf: 1 } }).decision, 'tolak');
});
test('agent tidak aktif dan polisi sekat → tolak', () => {
  assert.equal(evaluateAction({ agent: { ...agent, status: 'tidak_aktif' }, task: task(), policy: rutin }).decision, 'tolak');
  assert.equal(evaluateAction({ agent, task: task(), policy: { ...rutin, mode: 'sekat' } }).decision, 'tolak');
});
test('had penggunaan → tahan', () => {
  assert.equal(evaluateAction({ agent, task: task(), policy: rutin, usage: { tasksToday: 5 } }).decision, 'tahan');
  assert.equal(evaluateAction({ agent, task: task(), policy: rutin, usage: { orgCostMonth: 100 }, settings: { orgMonthlyCostLimit: 100 } }).decision, 'tahan');
});
