import { useState } from 'react';
import { del, post, put, type Session } from '../api';
import { Badge, Confirm, DemoBadge, Field, Modal, States, StatusBadge, useAction, useApi } from '../ui';
import { AVATAR_KEYS } from '../world/people';

const BLANK = { name: '', kind: 'agent', avatar: 'lelaki_a', role_title: '', role_id: '', department_id: '', description: '', skills: [], instructions: '', connector_id: '', model: '', schedule: '', allowed_tools: [], allowed_actions: ['rutin'], status: 'aktif', daily_task_limit: 20, monthly_cost_limit: 50 };
const AVATAR_LABEL: Record<string, string> = { lelaki_a: 'Lelaki A (sut biru tua)', lelaki_b: 'Lelaki B (sut arang)', lelaki_c: 'Lelaki C (sut kelabu)', wanita_a: 'Wanita A (blazer merah hati)', wanita_b: 'Wanita B (blazer teal)', wanita_tudung_a: 'Wanita bertudung A', wanita_tudung_b: 'Wanita bertudung B', wanita_tudung_c: 'Wanita bertudung C' };

export default function Roster({ session }: { session: Session; go: (p: string) => void }) {
  const canEdit = session.permissions.includes('urus_staf');
  const agents = useApi<any[]>('/agents');
  const depts = useApi<any[]>('/departments');
  const roles = useApi<any>('/roles');
  const policies = useApi<any>('/policies');
  const ai = useApi<any[]>('/connectors/ai');
  const act = useAction();
  const [filter, setFilter] = useState('semua');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<any | null>(null);
  const [plat, setPlat] = useState<any | null>(null);
  const [platRows, setPlatRows] = useState<any[]>([]);
  const [remove, setRemove] = useState<any | null>(null);

  const rows = (agents.data ?? []).filter((a) => (filter === 'semua' || a.kind === filter) && `${a.name} ${a.role_title} ${a.department}`.toLowerCase().includes(q.toLowerCase()));
  const set = (k: string, v: any) => setEdit((e: any) => ({ ...e, [k]: v }));
  const toggle = (k: string, v: string) => set(k, edit[k].includes(v) ? edit[k].filter((x: string) => x !== v) : [...edit[k], v]);
  const save = async () => {
    const body = { ...edit, skills: typeof edit.skills === 'string' ? edit.skills : edit.skills.join(', '), allowed_tools: typeof edit.allowed_tools === 'string' ? edit.allowed_tools : edit.allowed_tools.join(', ') };
    const ok = await act(() => (edit.id ? put(`/agents/${edit.id}`, body) : post('/agents', body)), edit.id ? 'Profil dikemas kini.' : 'Profil dicipta.');
    if (ok) { setEdit(null); void agents.reload(true); }
  };
  const setStatus = async (a: any, status: string) => { if (await act(() => put(`/agents/${a.id}`, { status }), status === 'aktif' ? `${a.name} diaktifkan.` : `${a.name} dinyahaktifkan.`)) void agents.reload(true); };
  const openPlat = async (a: any) => { const r = await act(() => import('../api').then((m) => m.api(`/agents/${a.id}/platforms`))); if (r) { setPlatRows(r as any[]); setPlat(a); } };
  const savePlat = async () => { if (await act(() => put(`/agents/${plat.id}/platforms`, { platforms: platRows }), 'Kebenaran platform disimpan.')) setPlat(null); };
  const connector = ai.data?.find((c) => String(c.id) === String(edit?.connector_id));

  return (
    <div className="page">
      <div className="page-head"><h1>Staf & Agent</h1>{canEdit && <button className="btn btn-primary" onClick={() => setEdit({ ...BLANK })}>+ Tambah staf / agent</button>}</div>
      <div className="toolbar">
        <div className="seg">{[['semua', 'Semua'], ['staf', 'Staf'], ['agent', 'AI Agent']].map(([k, l]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}</div>
        <input placeholder="Cari nama, peranan atau jabatan…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <States loading={agents.loading} error={agents.error} onRetry={() => void agents.reload()} empty={rows.length === 0} emptyText="Tiada profil sepadan.">
        <div className="cards">
          {rows.map((a) => (
            <article key={a.id} className={`card person ${a.status !== 'aktif' ? 'dim' : ''}`}>
              <header><div className={`avatar avatar-${a.avatar}`}>{a.name.slice(0, 1)}</div><div><h3>{a.name}</h3><div className="muted">{a.role_title || '—'}</div></div></header>
              <div className="row-gap"><Badge tone={a.kind === 'agent' ? 'info' : 'gold'}>{a.kind === 'agent' ? 'AI Agent' : 'Staf'}</Badge><StatusBadge status={a.status} /><DemoBadge show={a.is_demo} />{a.department && <Badge>{a.department}</Badge>}</div>
              <p>{a.description}</p>
              {a.skills?.length > 0 && <div className="chips">{a.skills.map((s: string) => <span key={s}>{s}</span>)}</div>}
              {canEdit && <>
                <div className="muted small">Model: {a.connector_name ? `${a.connector_name}${a.model ? ` · ${a.model}` : ''}` : 'tiada'} {a.ai_live ? <Badge tone="ok">AI aktif</Badge> : <Badge tone="demo">simulasi</Badge>} · Had: {a.daily_task_limit} tugasan/hari, ${a.monthly_cost_limit}/bulan</div>
                <footer>
                  <button className="btn btn-small" onClick={() => setEdit({ ...a, role_id: a.role_id ?? '', department_id: a.department_id ?? '', connector_id: a.connector_id ?? '' })}>Edit</button>
                  <button className="btn btn-small" onClick={() => void openPlat(a)}>Platform</button>
                  <button className="btn btn-small" onClick={() => void setStatus(a, a.status === 'aktif' ? 'tidak_aktif' : 'aktif')}>{a.status === 'aktif' ? 'Nyahaktifkan' : 'Aktifkan'}</button>
                  <button className="btn btn-small btn-danger" onClick={() => setRemove(a)}>Padam</button>
                </footer>
              </>}
            </article>
          ))}
        </div>
      </States>

      {edit && (
        <Modal wide title={edit.id ? `Edit profil — ${edit.name}` : 'Tambah staf / agent'} onClose={() => setEdit(null)} footer={<><button className="btn" onClick={() => setEdit(null)}>Batal</button><button className="btn btn-primary" onClick={save}>Simpan</button></>}>
          <div className="form-grid">
            <Field label="Nama *"><input value={edit.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Jenis"><select value={edit.kind} onChange={(e) => set('kind', e.target.value)}><option value="agent">AI Agent</option><option value="staf">Staf</option></select></Field>
            <Field label="Peranan (jawatan)"><input value={edit.role_title} onChange={(e) => set('role_title', e.target.value)} /></Field>
            <Field label="Avatar" hint="Placeholder; boleh diganti dengan GLB berlesen."><select value={edit.avatar} onChange={(e) => set('avatar', e.target.value)}>{AVATAR_KEYS.map((k) => <option key={k} value={k}>{AVATAR_LABEL[k] ?? k}</option>)}</select></Field>
            <Field label="Jabatan"><select value={edit.department_id} onChange={(e) => set('department_id', e.target.value)}><option value="">— tiada —</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
            <Field label="Tahap akses (peranan sistem)" hint="Menentukan ruang yang boleh dimasuki."><select value={edit.role_id} onChange={(e) => set('role_id', e.target.value)}><option value="">— tiada —</option>{roles.data?.roles.filter((r: any) => r.key !== 'ceo').map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
            <Field label="Status"><select value={edit.status} onChange={(e) => set('status', e.target.value)}><option value="aktif">Aktif</option><option value="tidak_aktif">Tidak aktif</option></select></Field>
            <Field label="Jadual"><input value={edit.schedule} onChange={(e) => set('schedule', e.target.value)} placeholder="cth. Isnin–Jumaat, 9:00–18:00" /></Field>
            <Field full label="Penerangan"><textarea rows={2} value={edit.description} onChange={(e) => set('description', e.target.value)} /></Field>
            <Field full label="Kemahiran" hint="Asingkan dengan koma."><input value={Array.isArray(edit.skills) ? edit.skills.join(', ') : edit.skills} onChange={(e) => set('skills', e.target.value)} /></Field>
            <Field full label="Arahan (system prompt)"><textarea rows={4} value={edit.instructions} onChange={(e) => set('instructions', e.target.value)} /></Field>
            <Field label="Penyedia AI lalai" hint="Jenis kerja tertentu boleh menggunakan penyedia lain (lihat Polisi & Workflow)."><select value={edit.connector_id} onChange={(e) => set('connector_id', e.target.value)}><option value="">— tiada (simulasi) —</option>{ai.data?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.status.replaceAll('_', ' ')})</option>)}</select></Field>
            <Field label="Model" hint={connector?.models?.length ? 'Pilih daripada senarai atau taip sendiri.' : 'Senarai model muncul selepas ujian sambungan berjaya.'}>
              <input list="models" value={edit.model} onChange={(e) => set('model', e.target.value)} placeholder={connector?.default_model || 'model lalai penyedia'} />
              <datalist id="models">{connector?.models?.map((m: string) => <option key={m} value={m} />)}</datalist>
            </Field>
            <Field label="Had tugasan sehari" hint="0 = tiada had"><input type="number" min={0} value={edit.daily_task_limit} onChange={(e) => set('daily_task_limit', e.target.value)} /></Field>
            <Field label="Had kos bulanan (USD)" hint="0 = tiada had"><input type="number" min={0} step="0.5" value={edit.monthly_cost_limit} onChange={(e) => set('monthly_cost_limit', e.target.value)} /></Field>
            <Field full label="Alat yang dibenarkan" hint="Asingkan dengan koma."><input value={Array.isArray(edit.allowed_tools) ? edit.allowed_tools.join(', ') : edit.allowed_tools} onChange={(e) => set('allowed_tools', e.target.value)} /></Field>
            <div className="field field-full"><span>Tindakan yang dibenarkan</span>
              <div className="checks">{policies.data?.policies.map((p: any) => <label key={p.action_type}><input type="checkbox" checked={edit.allowed_actions.includes(p.action_type)} onChange={() => toggle('allowed_actions', p.action_type)} /> {p.label} {p.controlled ? <Badge tone="warn">perlu kelulusan</Badge> : null}</label>)}</div>
              <small>Kebenaran sahaja tidak mencukupi: tindakan terkawal tetap melalui polisi kelulusan.</small>
            </div>
          </div>
        </Modal>
      )}
      {plat && (
        <Modal wide title={`Platform media sosial — ${plat.name}`} onClose={() => setPlat(null)} footer={<><button className="btn" onClick={() => setPlat(null)}>Batal</button><button className="btn btn-primary" onClick={savePlat}>Simpan</button></>}>
          <p className="muted">Kebenaran berasingan untuk analitik, draf, penjadualan dan penerbitan. Platform di luar senarai dibenarkan organisasi (Integrasi → Platform) tidak boleh digunakan walaupun ditanda di sini.</p>
          <div className="table-wrap"><table><thead><tr><th>Platform</th><th>Analitik</th><th>Draf</th><th>Jadual</th><th>Terbit</th></tr></thead><tbody>
            {platRows.map((p, i) => <tr key={p.platform_id} className={p.enabled ? '' : 'dim'}><td>{p.name} {!p.enabled && <Badge>tidak dibenarkan organisasi</Badge>}</td>
              {['analitik', 'draf', 'jadual', 'terbit'].map((k) => <td key={k}><input type="checkbox" checked={Boolean(p[k])} onChange={(e) => setPlatRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: e.target.checked ? 1 : 0 } : x)))} /></td>)}</tr>)}
          </tbody></table></div>
        </Modal>
      )}
      {remove && <Confirm danger text={`Padam profil "${remove.name}"? Tugasan yang diagihkan kepadanya akan dikembalikan ke status baharu. Tindakan ini tidak boleh dibatalkan.`} onNo={() => setRemove(null)} onYes={async () => { if (await act(() => del(`/agents/${remove.id}`), 'Profil dipadam.')) void agents.reload(true); setRemove(null); }} />}
    </div>
  );
}
