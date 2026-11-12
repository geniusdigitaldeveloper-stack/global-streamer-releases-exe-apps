import { useState } from 'react';
import { api, post, put, type Session } from '../api';
import { Badge, DemoBadge, Field, Modal, SimBadge, States, StatusBadge, STATUS_LABEL, fmtTime, useAction, useApi } from '../ui';

const BLANK = { title: '', description: '', department_id: '', agent_id: '', action_type: 'rutin', work_type: 'umum', priority: 'sederhana', success_criteria: '', evidence: '', clear_instructions: true, policy_conflict: false, impact: 'biasa', platform_id: '' };
const DECISION_TEXT: Record<string, string> = { benar: 'Dibenarkan oleh polisi.', kelulusan: 'Dihantar ke queue kelulusan.', tolak: 'Ditolak oleh polisi.', tahan: 'Ditahan oleh had penggunaan.' };

export default function Tasks({ session }: { session: Session; go: (p: string) => void }) {
  const canEdit = session.permissions.includes('urus_tugasan');
  const [status, setStatus] = useState('');
  const tasks = useApi<any>(`/tasks${status ? `?status=${status}` : ''}`, 5000);
  const agents = useApi<any[]>('/agents');
  const depts = useApi<any[]>('/departments');
  const policies = useApi<any>('/policies');
  const plats = useApi<any[]>('/platforms');
  const wts = useApi<any>('/work-types');
  const act = useAction();
  const [form, setForm] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [run, setRun] = useState<any | null>(null);
  const [conf, setConf] = useState('90');
  const [outcome, setOutcome] = useState<any | null>(null);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const refresh = () => void tasks.reload(true);
  const open = async (id: number) => { const d = await act(() => api(`/tasks/${id}`)); if (d) setDetail(d); };
  const save = async () => {
    const ok = await act(() => (form.id ? put(`/tasks/${form.id}`, form) : post('/tasks', form)), form.id ? 'Tugasan dikemas kini.' : 'Tugasan dicipta.');
    if (ok) { setForm(null); refresh(); }
  };
  const doRun = async () => {
    const r: any = await act(() => post(`/tasks/${run.id}/run`, { confidence: conf === '' ? null : Number(conf) / 100 }));
    setRun(null); refresh();
    if (r) setOutcome(r);
  };
  const move = async (t: any, action: string, msg: string) => { if (await act(() => post(`/tasks/${t.id}/${action}`, {}), msg)) { refresh(); if (detail?.id === t.id) void open(t.id); } };
  const assign = async (t: any, agent_id: string) => { if (await act(() => post(`/tasks/${t.id}/assign`, { agent_id: agent_id || null }), 'Agihan dikemas kini.')) refresh(); };
  const actions = (t: any) => canEdit && (
    <div className="row-gap">
      {['baharu', 'diagihkan', 'ditahan'].includes(t.status) && <button className="btn btn-small btn-primary" disabled={!t.agent_id} title={t.agent_id ? '' : 'Agihkan kepada agent dahulu'} onClick={() => setRun(t)}>▶ Jalankan</button>}
      {t.status === 'berjalan' && <button className="btn btn-small" onClick={() => void move(t, 'pause', 'Tugasan dijeda.')}>⏸ Jeda</button>}
      {t.status === 'dijeda' && <button className="btn btn-small" onClick={() => void move(t, 'resume', 'Tugasan diteruskan.')}>⏵ Teruskan</button>}
      {['berjalan', 'tindakan_manual'].includes(t.status) && <button className="btn btn-small" onClick={() => void move(t, 'complete', 'Tugasan ditandakan selesai.')}>✓ Selesai</button>}
      {t.status !== 'ditutup' && <button className="btn btn-small" onClick={() => void move(t, 'close', 'Tugasan ditutup.')}>Tutup</button>}
    </div>
  );

  return (
    <div className="page">
      <div className="page-head"><h1>Tugasan</h1>{canEdit && <button className="btn btn-primary" onClick={() => setForm({ ...BLANK })}>+ Cipta tugasan</button>}</div>
      <div className="toolbar"><div className="seg wrap"><button className={status === '' ? 'on' : ''} onClick={() => setStatus('')}>Semua</button>{tasks.data?.statuses.map((s: string) => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{STATUS_LABEL[s]}</button>)}</div></div>
      <States loading={tasks.loading && !tasks.data} error={tasks.error} onRetry={() => void tasks.reload()} empty={tasks.data?.tasks.length === 0} emptyText="Tiada tugasan dalam paparan ini.">
        <div className="table-wrap"><table><thead><tr><th>Tugasan</th><th>Status</th><th>Agent</th><th>Jenis</th><th>Dikemas kini</th><th>Tindakan</th></tr></thead><tbody>
          {tasks.data?.tasks.map((t: any) => (
            <tr key={t.id}>
              <td><a className="link" onClick={() => void open(t.id)}>{t.title}</a> <DemoBadge show={t.is_demo} /> <SimBadge show={t.result_is_simulation} />{t.priority === 'tinggi' && <Badge tone="bad">utama</Badge>}
                {t.hold_reason && <div className="reason">⚠ {t.hold_reason}</div>}<div className="muted small">{t.department ?? 'Tiada jabatan'}</div></td>
              <td><StatusBadge status={t.status} /></td>
              <td>{canEdit && ['baharu', 'diagihkan', 'ditahan'].includes(t.status)
                ? <select value={t.agent_id ?? ''} onChange={(e) => void assign(t, e.target.value)}><option value="">— belum diagih —</option>{agents.data?.filter((a) => a.status === 'aktif').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                : t.agent_name ?? '—'}</td>
              <td>{t.action_label}<div className="muted small">{t.work_label}{t.platform ? ` · ${t.platform}` : ''}</div></td>
              <td className="nowrap">{fmtTime(t.updated_at)}</td>
              <td>{actions(t)}</td>
            </tr>
          ))}
        </tbody></table></div>
      </States>

      {form && (
        <Modal wide title={form.id ? 'Edit tugasan' : 'Cipta tugasan'} onClose={() => setForm(null)} footer={<><button className="btn" onClick={() => setForm(null)}>Batal</button><button className="btn btn-primary" onClick={save}>Simpan</button></>}>
          <div className="form-grid">
            <Field full label="Tajuk *"><input value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus /></Field>
            <Field full label="Butiran / arahan"><textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
            <Field label="Jenis tindakan" hint="Menentukan polisi kelulusan."><select value={form.action_type} onChange={(e) => set('action_type', e.target.value)}>{policies.data?.policies.map((p: any) => <option key={p.action_type} value={p.action_type}>{p.label}{p.controlled ? ' (terkawal)' : ''}</option>)}</select></Field>
            <Field label="Jenis kerja" hint="Menentukan alat AI yang digunakan."><select value={form.work_type} onChange={(e) => set('work_type', e.target.value)}>{wts.data?.work_types.map((w: any) => <option key={w.key} value={w.key}>{w.label}</option>)}</select></Field>
            <Field label="Jabatan"><select value={form.department_id ?? ''} onChange={(e) => set('department_id', e.target.value)}><option value="">— tiada —</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
            {!form.id && <Field label="Agihkan kepada"><select value={form.agent_id} onChange={(e) => set('agent_id', e.target.value)}><option value="">— kemudian —</option>{agents.data?.filter((a) => a.status === 'aktif').map((a) => <option key={a.id} value={a.id}>{a.name} — {a.department}</option>)}</select></Field>}
            <Field label="Platform (jika berkaitan)"><select value={form.platform_id ?? ''} onChange={(e) => set('platform_id', e.target.value)}><option value="">— tiada —</option>{plats.data?.map((p) => <option key={p.id} value={p.id}>{p.name}{p.enabled ? '' : ' (tidak dibenarkan)'}</option>)}</select></Field>
            <Field label="Keutamaan"><select value={form.priority} onChange={(e) => set('priority', e.target.value)}><option value="rendah">Rendah</option><option value="sederhana">Sederhana</option><option value="tinggi">Tinggi</option></select></Field>
            <Field label="Kesan"><select value={form.impact} onChange={(e) => set('impact', e.target.value)}><option value="biasa">Biasa</option><option value="penting">Penting (perlu kelulusan)</option></select></Field>
            <Field full label="Kriteria kejayaan" hint="Diperlukan untuk pelaksanaan automatik."><input value={form.success_criteria} onChange={(e) => set('success_criteria', e.target.value)} /></Field>
            <Field full label="Bukti / rujukan" hint="Diperlukan untuk tindakan terkawal."><textarea rows={2} value={form.evidence} onChange={(e) => set('evidence', e.target.value)} /></Field>
            <div className="field field-full checks"><label><input type="checkbox" checked={Boolean(form.clear_instructions)} onChange={(e) => set('clear_instructions', e.target.checked)} /> Arahan jelas dan lengkap</label>
              <label><input type="checkbox" checked={Boolean(form.policy_conflict)} onChange={(e) => set('policy_conflict', e.target.checked)} /> Ada percanggahan polisi yang diketahui</label></div>
          </div>
        </Modal>
      )}
      {run && (
        <Modal title={`Jalankan — ${run.title}`} onClose={() => setRun(null)} footer={<><button className="btn" onClick={() => setRun(null)}>Batal</button><button className="btn btn-primary" onClick={doRun}>Semak polisi & jalankan</button></>}>
          <p>{run.agent_name} akan cuba melaksanakan tugasan ini. Polisi menentukan sama ada ia dibenarkan, memerlukan kelulusan, atau ditolak.</p>
          <Field label="Keyakinan agent (%)" hint="Untuk demonstrasi. Keyakinan tinggi tidak mengatasi kebenaran atau polisi kelulusan."><input type="number" min={0} max={100} value={conf} onChange={(e) => setConf(e.target.value)} /></Field>
        </Modal>
      )}
      {outcome && (
        <Modal title="Keputusan polisi" onClose={() => setOutcome(null)} footer={<button className="btn btn-primary" onClick={() => setOutcome(null)}>OK</button>}>
          <p><Badge tone={outcome.decision === 'benar' ? 'ok' : outcome.decision === 'kelulusan' ? 'warn' : 'bad'}>{DECISION_TEXT[outcome.decision]}</Badge></p>
          <ul>{outcome.reasons.map((r: any) => <li key={r.code}>{r.text}</li>)}</ul>
          {outcome.execution?.mode === 'simulasi' && <div className="notice notice-warn"><b>SIMULASI:</b> tiada penyedia AI aktif, jadi tiada kerja AI sebenar dilaksanakan.</div>}
          {outcome.execution?.mode === 'ai' && <div className="notice notice-info">Sedang dijana oleh {outcome.execution.provider}{outcome.execution.tool ? ` sebagai brief untuk ${outcome.execution.tool}` : ''}. Hasil akan muncul dalam butiran tugasan.</div>}
          {outcome.execution?.mode === 'manual' && <div className="notice notice-info">Brief disediakan{outcome.execution.tool ? ` untuk ${outcome.execution.tool}` : ''}. Laksanakan secara manual, kemudian tandakan selesai.</div>}
        </Modal>
      )}
      {detail && (
        <Modal wide title={detail.title} onClose={() => setDetail(null)} footer={<>{canEdit && !['selesai', 'ditutup', 'ditolak'].includes(detail.status) && <button className="btn" onClick={() => { setForm({ ...detail }); setDetail(null); }}>Edit</button>}<button className="btn btn-primary" onClick={() => setDetail(null)}>Tutup paparan</button></>}>
          <div className="row-gap"><StatusBadge status={detail.status} /><DemoBadge show={detail.is_demo} /><SimBadge show={detail.result_is_simulation} /><Badge>{detail.action_label}</Badge><Badge>{detail.work_label}</Badge></div>
          <table className="kv"><tbody>
            <tr><td>Agent</td><td>{detail.agent_name ?? '—'}</td></tr><tr><td>Jabatan</td><td>{detail.department ?? '—'}</td></tr>
            <tr><td>Butiran</td><td>{detail.description || '—'}</td></tr><tr><td>Kriteria kejayaan</td><td>{detail.success_criteria || '—'}</td></tr><tr><td>Bukti</td><td>{detail.evidence || '—'}</td></tr>
            {detail.hold_reason && <tr><td>Sebab ditahan/ditolak</td><td className="reason">{detail.hold_reason}</td></tr>}
          </tbody></table>
          {detail.result && <><h4>Hasil {detail.result_is_simulation ? '(SIMULASI — bukan kerja AI sebenar)' : ''}</h4><pre className="result">{detail.result}</pre></>}
          <h4>Sejarah</h4>
          <ul className="feed">{detail.events.map((e: any) => <li key={e.id}><b>{e.actor}</b> · {e.event.replaceAll('_', ' ')}<div className="muted">{fmtTime(e.ts)}{e.detail ? ` — ${e.detail}` : ''}</div></li>)}</ul>
        </Modal>
      )}
    </div>
  );
}
