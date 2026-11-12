import { useEffect, useState } from 'react';
import { del, post, put, type Session } from '../api';
import { Badge, Confirm, DemoBadge, Field, Modal, States, useAction, useApi } from '../ui';

const MODE: Record<string, string> = { auto: 'Automatik', kelulusan: 'Perlu kelulusan', sekat: 'Disekat' };

export default function Policies(_: { session: Session; go: (p: string) => void }) {
  const pol = useApi<any>('/policies');
  const wf = useApi<any[]>('/workflows');
  const wt = useApi<any>('/work-types');
  const ai = useApi<any[]>('/connectors/ai');
  const depts = useApi<any[]>('/departments');
  const act = useAction();
  const [tab, setTab] = useState('polisi');
  const [flow, setFlow] = useState<any | null>(null);
  const [work, setWork] = useState<any | null>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const [remove, setRemove] = useState<{ path: string; name: string } | null>(null);
  useEffect(() => { if (wt.data) setRepos(wt.data.repos); }, [wt.data]);

  const setMode = async (p: any, mode: string) => { if (await act(() => put(`/policies/${p.action_type}`, { mode }), `Polisi "${p.label}" dikemas kini.`)) void pol.reload(true); };
  const saveFlow = async () => { if (await act(() => (flow.id ? put(`/workflows/${flow.id}`, flow) : post('/workflows', flow)), 'Workflow disimpan.')) { setFlow(null); void wf.reload(true); } };
  const saveWork = async () => { if (await act(() => (work.id ? put(`/work-types/${work.id}`, work) : post('/work-types', work)), 'Jenis kerja disimpan.')) { setWork(null); void wt.reload(true); } };
  const saveRepos = async () => { if (await act(() => put('/repos', { repos }), 'Senarai repo disimpan.')) void wt.reload(true); };
  const step = (i: number, k: string, v: any) => setFlow({ ...flow, steps: flow.steps.map((s: any, j: number) => (j === i ? { ...s, [k]: v } : s)) });
  const controlled = new Set(pol.data?.policies.filter((p: any) => p.controlled).map((p: any) => p.action_type));
  const toolLabel = (k: string) => wt.data?.tools.find((x: any) => x.key === k)?.label ?? k;

  return (
    <div className="page">
      <h1>Polisi & Workflow</h1>
      <div className="toolbar"><div className="seg">{[['polisi', 'Polisi kelulusan'], ['kerja', 'Jenis kerja & alat AI'], ['workflow', 'Workflow']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
        {tab === 'workflow' && <button className="btn btn-primary" onClick={() => setFlow({ name: '', description: '', active: true, steps: [{ name: '', department: '', action_type: 'rutin', approval: false }] })}>+ Tambah workflow</button>}
        {tab === 'kerja' && <button className="btn btn-primary" onClick={() => setWork({ label: '', tool: 'ai', connector_id: '', model: '', guidance: '' })}>+ Tambah jenis kerja</button>}
      </div>

      {tab === 'polisi' && <States loading={pol.loading} error={pol.error} onRetry={() => void pol.reload()}>
        <div className="notice notice-info">Agent meminta kelulusan apabila arahan tidak jelas, bukti tidak mencukupi, tindakan di luar skop, ada percanggahan polisi, atau tindakan memberi kesan penting. Keyakinan agent tidak boleh mengatasi kebenaran atau polisi. Tindakan <b>terkawal</b> tidak boleh ditetapkan kepada automatik.</div>
        <div className="table-wrap"><table><thead><tr><th>Jenis tindakan</th><th>Penerangan</th><th>Mod</th></tr></thead><tbody>
          {pol.data?.policies.map((p: any) => <tr key={p.action_type}><td><b>{p.label}</b> {p.controlled ? <Badge tone="warn">terkawal</Badge> : null}</td><td>{p.description}</td>
            <td><select value={p.mode} onChange={(e) => void setMode(p, e.target.value)}>{Object.entries(MODE).map(([k, l]) => <option key={k} value={k} disabled={p.controlled && k === 'auto'}>{l}</option>)}</select></td></tr>)}
        </tbody></table></div>
        <p className="muted">Ambang keyakinan untuk pelaksanaan automatik: <b>{Math.round((pol.data?.confidence_threshold ?? 0.8) * 100)}%</b> (ubah di Tetapan).</p>
      </States>}

      {tab === 'kerja' && <States loading={wt.loading} error={wt.error} onRetry={() => void wt.reload()}>
        <div className="notice notice-info">Setiap jenis kerja dipetakan kepada alat AI. Penyedia API dipanggil terus oleh aplikasi. <b>Claude Code</b> dan <b>Flow AI</b> tiada sambungan automatik di sini: aplikasi menjana <i>brief kerja</i> yang lengkap dan tugasan menunggu anda menjalankannya dalam alat tersebut.</div>
        <div className="table-wrap"><table><thead><tr><th>Jenis kerja</th><th>Alat</th><th>Penyedia & model</th><th>Panduan</th><th /></tr></thead><tbody>
          {wt.data?.work_types.map((w: any) => { const c = ai.data?.find((x) => x.id === w.connector_id); return <tr key={w.id}><td><b>{w.label}</b></td><td><Badge tone={w.tool === 'ai' ? 'info' : 'warn'}>{toolLabel(w.tool)}</Badge></td>
            <td>{w.connector_name ? <>{w.connector_name}{w.model ? ` · ${w.model}` : ''} {c && c.status !== 'aktif' ? <Badge tone="demo">{c.status.replaceAll('_', ' ')}</Badge> : null}</> : <span className="muted">penyedia lalai agent</span>}</td>
            <td className="clip">{w.guidance || '—'}</td>
            <td className="row-gap"><button className="btn btn-small" onClick={() => setWork({ ...w, connector_id: w.connector_id ?? '' })}>Edit</button>{w.key !== 'umum' && <button className="btn btn-small btn-danger" onClick={() => setRemove({ path: `/work-types/${w.id}`, name: w.label })}>Padam</button>}</td></tr>; })}
        </tbody></table></div>
        <h2>Repo untuk kerja video & kod</h2>
        <p className="muted">Senarai ini dimasukkan ke dalam brief supaya agent memilih skill dan templat daripada repo anda.</p>
        {repos.map((r, i) => <div key={i} className="repo-row"><input placeholder="Nama repo" value={r.name} onChange={(e) => setRepos(repos.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /><input placeholder="Lokasi (owner/repo atau laluan)" value={r.location} onChange={(e) => setRepos(repos.map((x, j) => (j === i ? { ...x, location: e.target.value } : x)))} /><input placeholder="Kegunaan" value={r.purpose} onChange={(e) => setRepos(repos.map((x, j) => (j === i ? { ...x, purpose: e.target.value } : x)))} /><button className="icon-btn" onClick={() => setRepos(repos.filter((_, j) => j !== i))}>✕</button></div>)}
        <div className="row-gap"><button className="btn" onClick={() => setRepos([...repos, { name: '', location: '', purpose: '' }])}>+ Tambah repo</button><button className="btn btn-primary" onClick={saveRepos}>Simpan senarai repo</button></div>
      </States>}

      {tab === 'workflow' && <States loading={wf.loading} error={wf.error} onRetry={() => void wf.reload()} empty={wf.data?.length === 0} emptyText="Belum ada workflow.">
        <div className="cards">{wf.data?.map((w) => (
          <article key={w.id} className="card"><header><h3>{w.name}</h3><div className="row-gap">{w.active ? <Badge tone="ok">Aktif</Badge> : <Badge>Tidak aktif</Badge>}<DemoBadge show={w.is_demo} /></div></header><p className="muted">{w.description}</p>
            <ol className="steps">{w.steps.map((s: any, i: number) => <li key={i}><b>{s.name}</b> <span className="muted">· {s.department || 'mana-mana jabatan'} · {pol.data?.policies.find((p: any) => p.action_type === s.action_type)?.label}</span> {s.approval ? <Badge tone="warn">kelulusan</Badge> : <Badge tone="ok">auto</Badge>}</li>)}</ol>
            <footer><button className="btn btn-small" onClick={() => setFlow({ ...w })}>Edit</button><button className="btn btn-small btn-danger" onClick={() => setRemove({ path: `/workflows/${w.id}`, name: w.name })}>Padam</button></footer>
          </article>))}</div>
        <p className="muted">Workflow ialah templat langkah dan titik kelulusan untuk rujukan pasukan. Pelaksanaan automatik berantai belum dibina; cipta tugasan bagi setiap langkah.</p>
      </States>}

      {flow && <Modal wide title={flow.id ? 'Edit workflow' : 'Tambah workflow'} onClose={() => setFlow(null)} footer={<><button className="btn" onClick={() => setFlow(null)}>Batal</button><button className="btn btn-primary" onClick={saveFlow}>Simpan</button></>}>
        <div className="form-grid"><Field label="Nama *"><input value={flow.name} onChange={(e) => setFlow({ ...flow, name: e.target.value })} /></Field>
          <label className="check"><input type="checkbox" checked={Boolean(flow.active)} onChange={(e) => setFlow({ ...flow, active: e.target.checked })} /> Aktif</label>
          <Field full label="Penerangan"><input value={flow.description} onChange={(e) => setFlow({ ...flow, description: e.target.value })} /></Field></div>
        <h4>Langkah</h4>
        {flow.steps.map((s: any, i: number) => <div key={i} className="step-row"><span>{i + 1}.</span><input placeholder="Nama langkah" value={s.name} onChange={(e) => step(i, 'name', e.target.value)} />
          <select value={s.department} onChange={(e) => step(i, 'department', e.target.value)}><option value="">Mana-mana jabatan</option>{depts.data?.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}</select>
          <select value={s.action_type} onChange={(e) => step(i, 'action_type', e.target.value)}>{pol.data?.policies.map((p: any) => <option key={p.action_type} value={p.action_type}>{p.label}</option>)}</select>
          <label className="check"><input type="checkbox" checked={controlled.has(s.action_type) || Boolean(s.approval)} disabled={controlled.has(s.action_type)} onChange={(e) => step(i, 'approval', e.target.checked)} /> Kelulusan</label>
          <button className="icon-btn" onClick={() => setFlow({ ...flow, steps: flow.steps.filter((_: any, j: number) => j !== i) })}>✕</button></div>)}
        <button className="btn" onClick={() => setFlow({ ...flow, steps: [...flow.steps, { name: '', department: '', action_type: 'rutin', approval: false }] })}>+ Tambah langkah</button>
      </Modal>}
      {work && <Modal wide title={work.id ? `Edit jenis kerja — ${work.label}` : 'Tambah jenis kerja'} onClose={() => setWork(null)} footer={<><button className="btn" onClick={() => setWork(null)}>Batal</button><button className="btn btn-primary" onClick={saveWork}>Simpan</button></>}>
        <div className="form-grid"><Field label="Nama *"><input value={work.label} onChange={(e) => setWork({ ...work, label: e.target.value })} /></Field>
          <Field label="Alat" hint="Alat selain API menghasilkan brief untuk pelaksanaan manual."><select value={work.tool} onChange={(e) => setWork({ ...work, tool: e.target.value })}>{wt.data?.tools.map((x: any) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></Field>
          <Field label="Penyedia AI" hint="Menjana hasil atau brief."><select value={work.connector_id} onChange={(e) => setWork({ ...work, connector_id: e.target.value })}><option value="">— penyedia lalai agent —</option>{ai.data?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.status.replaceAll('_', ' ')})</option>)}</select></Field>
          <Field label="Model"><input list="wt-models" value={work.model} onChange={(e) => setWork({ ...work, model: e.target.value })} placeholder="model lalai penyedia" /><datalist id="wt-models">{ai.data?.find((c) => String(c.id) === String(work.connector_id))?.models?.map((m: string) => <option key={m} value={m} />)}</datalist></Field>
          <Field full label="Panduan kerja" hint="Dimasukkan ke dalam prompt: gaya, skill repo yang perlu digunakan, format output."><textarea rows={9} value={work.guidance} onChange={(e) => setWork({ ...work, guidance: e.target.value })} /></Field></div>
      </Modal>}
      {remove && <Confirm danger text={`Padam "${remove.name}"?`} onNo={() => setRemove(null)} onYes={async () => { if (await act(() => del(remove.path), 'Dipadam.')) { void wf.reload(true); void wt.reload(true); } setRemove(null); }} />}
    </div>
  );
}
