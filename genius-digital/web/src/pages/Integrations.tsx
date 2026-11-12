import { useState } from 'react';
import { del, post, put, type Session } from '../api';
import { Badge, Confirm, Field, Modal, States, StatusBadge, fmtTime, useAction, useApi } from '../ui';

export default function Integrations(_: { session: Session; go: (p: string) => void }) {
  const con = useApi<any>('/connectors');
  const plats = useApi<any[]>('/platforms');
  const act = useAction();
  const [tab, setTab] = useState('ai');
  const [cfg, setCfg] = useState<any | null>(null);
  const [secret, setSecret] = useState<any | null>(null);
  const [value, setValue] = useState('');
  const [testing, setTesting] = useState<number | null>(null);
  const [add, setAdd] = useState<string | null>(null);
  const [newPlat, setNewPlat] = useState('');
  const [remove, setRemove] = useState<any | null>(null);
  const reload = () => void con.reload(true);

  const test = async (c: any) => {
    setTesting(c.id);
    const r: any = await act(() => post(`/connectors/${c.id}/test`));
    setTesting(null); reload();
    if (r) await act(async () => { if (!r.result.ok) throw new Error(`${c.name}: ${r.result.message}`); }, `${c.name}: ${r.result.message}`);
  };
  const saveSecret = async () => { if (await act(() => post(`/connectors/${secret.id}/secret`, { value }), 'Rahsia disimpan tersulit di backend. Jalankan ujian sambungan.')) { setSecret(null); setValue(''); reload(); } };
  const saveCfg = async () => { if (await act(() => put(`/connectors/${cfg.id}`, { name: cfg.name, config: cfg.config }), 'Konfigurasi disimpan.')) { setCfg(null); reload(); } };
  const toggle = async (c: any) => { if (await act(() => post(`/connectors/${c.id}/enabled`, { enabled: !c.enabled }), c.enabled ? 'Connector dinyahaktifkan.' : 'Connector diaktifkan.')) reload(); };
  const list = (con.data?.connectors ?? []).filter((c: any) => c.kind === tab);

  return (
    <div className="page">
      <h1>Integrasi</h1>
      <div className="toolbar"><div className="seg">{[['ai', 'Penyedia AI'], ['pemasaran', 'Platform pemasaran'], ['platform', 'Senarai platform dibenarkan']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
        {tab !== 'platform' && <select value="" onChange={(e) => e.target.value && setAdd(e.target.value)}><option value="">+ Tambah connector…</option>{con.data?.providers.filter((p: any) => p.kind === tab).map((p: any) => <option key={p.provider} value={p.provider}>{p.label}</option>)}</select>}
      </div>
      <div className="notice notice-info">API key disimpan tersulit di backend (atau dibaca daripada environment variable) dan <b>tidak pernah</b> dihantar ke pelayar, log atau repository. Connector hanya berstatus “Aktif” selepas ujian sambungan sebenar berjaya.</div>

      {tab !== 'platform' && <States loading={con.loading} error={con.error} onRetry={() => void con.reload()} empty={list.length === 0} emptyText="Belum ada connector jenis ini.">
        <div className="cards">{list.map((c: any) => (
          <article key={c.id} className="card connector">
            <header><div><h3>{c.name}</h3><div className="muted">{c.provider_label}</div></div><StatusBadge status={c.status} /></header>
            <table className="kv"><tbody>
              <tr><td>{c.secret_label}</td><td>{c.secret.has_secret ? <>●●●●●●●● <span className="muted">({c.secret.source === 'env' ? `env ${c.env_var}` : `storan tersulit, ${fmtTime(c.secret.updated_at)}`})</span></> : c.secret.unreadable ? <span className="reason">Tidak dapat dibaca (kunci induk berubah) — masukkan semula.</span> : c.key_optional ? <span className="muted">tidak diperlukan</span> : <span className="muted">belum ditetapkan{c.env_var ? ` — atau set env ${c.env_var}` : ''}</span>}</td></tr>
              {c.config_fields.map((f: any) => <tr key={f.key}><td>{f.label}</td><td>{c.config[f.key] || <span className="muted">—</span>}</td></tr>)}
              <tr><td>Ujian terakhir</td><td>{c.last_test_at ? <>{fmtTime(c.last_test_at)} — <span className={c.last_test_ok ? '' : 'reason'}>{c.last_test_message}</span></> : <span className="muted">belum diuji</span>}</td></tr>
            </tbody></table>
            <div className="chips">{Object.entries(c.capabilities).map(([k, v]: any) => <span key={k}>{k.replaceAll('_', ' ')}: <StatusBadge status={v} /></span>)}</div>
            {c.requirements && <p className="muted small"><b>Keperluan:</b> {c.requirements}</p>}
            {c.docs && <p className="muted small">Dokumentasi rasmi: <a href={c.docs} target="_blank" rel="noreferrer">{c.docs}</a></p>}
            <footer>
              <button className="btn btn-small btn-primary" onClick={() => { setSecret(c); setValue(''); }}>{c.secret.source === 'storan' ? 'Ganti key' : 'Tetapkan key'}</button>
              <button className="btn btn-small" onClick={() => setCfg({ ...c, config: { ...c.config } })}>Konfigurasi</button>
              <button className="btn btn-small" disabled={testing === c.id} onClick={() => void test(c)}>{testing === c.id ? 'Menguji…' : 'Uji sambungan'}</button>
              <button className="btn btn-small" onClick={() => void toggle(c)}>{c.enabled ? 'Nyahaktifkan' : 'Aktifkan'}</button>
              {c.secret.source === 'storan' && <button className="btn btn-small btn-danger" onClick={() => setRemove({ path: `/connectors/${c.id}/secret`, text: `Padam key yang disimpan untuk ${c.name}?` })}>Padam key</button>}
              <button className="btn btn-small btn-danger" onClick={() => setRemove({ path: `/connectors/${c.id}`, text: `Buang connector ${c.name}? Agent yang menggunakannya akan kembali ke mod simulasi.` })}>Buang</button>
            </footer>
          </article>))}</div>
        {tab === 'pemasaran' && <p className="muted">Selagi tiada connector pemasaran aktif, penjadualan dan penerbitan menggunakan <b>aliran manual</b>: tindakan diluluskan di queue kelulusan, kemudian dilaksanakan oleh manusia dan ditandakan selesai.</p>}
      </States>}

      {tab === 'platform' && <States loading={plats.loading} error={plats.error} onRetry={() => void plats.reload()}>
        <p className="muted">Hanya platform yang dibenarkan di sini boleh digunakan oleh agent. Kebenaran analitik/draf/jadual/terbit bagi setiap agent ditetapkan di Staf & Agent → Platform.</p>
        <div className="plat-grid">{plats.data?.map((p) => <label key={p.id} className={`plat ${p.enabled ? 'on' : ''}`}><input type="checkbox" checked={Boolean(p.enabled)} onChange={async (e) => { if (await act(() => put(`/platforms/${p.id}`, { enabled: e.target.checked }), `${p.name} ${e.target.checked ? 'dibenarkan' : 'tidak dibenarkan'}.`)) void plats.reload(true); }} /> {p.name}</label>)}</div>
        <div className="row-gap"><input placeholder="Nama platform baharu" value={newPlat} onChange={(e) => setNewPlat(e.target.value)} /><button className="btn" disabled={!newPlat.trim()} onClick={async () => { if (await act(() => post('/platforms', { name: newPlat }), 'Platform ditambah.')) { setNewPlat(''); void plats.reload(true); } }}>+ Tambah platform</button></div>
      </States>}

      {secret && <Modal title={`${secret.secret.source === 'storan' ? 'Ganti' : 'Tetapkan'} ${secret.secret_label} — ${secret.name}`} onClose={() => setSecret(null)} footer={<><button className="btn" onClick={() => setSecret(null)}>Batal</button><button className="btn btn-primary" disabled={value.trim().length < 3} onClick={saveSecret}>Simpan dengan selamat</button></>}>
        <Field label={secret.secret_label} hint="Dihantar sekali ke backend, disulitkan (AES-256-GCM) dan tidak dipaparkan semula."><input type="password" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" autoFocus /></Field>
        {secret.env_var && <p className="muted">Alternatif: tetapkan environment variable <code>{secret.env_var}</code> pada pelayan.</p>}
      </Modal>}
      {cfg && <Modal title={`Konfigurasi — ${cfg.name}`} onClose={() => setCfg(null)} footer={<><button className="btn" onClick={() => setCfg(null)}>Batal</button><button className="btn btn-primary" onClick={saveCfg}>Simpan</button></>}>
        <Field label="Nama paparan"><input value={cfg.name} onChange={(e) => setCfg({ ...cfg, name: e.target.value })} /></Field>
        {cfg.config_fields.map((f: any) => <Field key={f.key} label={f.label}>
          <input list={f.key === 'default_model' ? 'cfg-models' : undefined} value={cfg.config[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setCfg({ ...cfg, config: { ...cfg.config, [f.key]: e.target.value } })} /></Field>)}
        <datalist id="cfg-models">{cfg.models.map((m: string) => <option key={m} value={m} />)}</datalist>
        <p className="muted">Menukar konfigurasi akan menetapkan semula status ujian sambungan.</p>
      </Modal>}
      {add && <Confirm text={`Tambah connector baharu untuk ${con.data?.providers.find((p: any) => p.provider === add)?.label}?`} onNo={() => setAdd(null)} onYes={async () => { if (await act(() => post('/connectors', { provider: add }), 'Connector ditambah. Tetapkan key untuk mula.')) reload(); setAdd(null); }} />}
      {remove && <Confirm danger text={remove.text} onNo={() => setRemove(null)} onYes={async () => { if (await act(() => del(remove.path), 'Selesai.')) reload(); setRemove(null); }} />}
    </div>
  );
}
