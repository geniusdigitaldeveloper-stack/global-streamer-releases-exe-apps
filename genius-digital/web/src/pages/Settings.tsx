import { useEffect, useState } from 'react';
import { put, type Session } from '../api';
import { Field, States, useAction, useApi } from '../ui';
import { LANGUAGES } from '../i18n';

export default function Settings({ session }: { session: Session; go: (p: string) => void }) {
  const s = useApi<any>('/settings');
  const act = useAction();
  const [f, setF] = useState<any | null>(null);
  useEffect(() => { if (s.data) setF({ ...s.data, org: { ...s.data.org }, confidence_pct: Math.round(s.data.confidence_threshold * 100) }); }, [s.data]);
  const save = async () => { if (await act(() => put('/settings', { org: f.org, demo_mode: f.demo_mode, confidence_threshold: f.confidence_pct / 100, org_monthly_cost_limit: f.org_monthly_cost_limit }), 'Tetapan disimpan.')) void s.reload(true); };
  return (
    <div className="page narrow">
      <h1>Tetapan Organisasi</h1>
      <States loading={s.loading || !f} error={s.error} onRetry={() => void s.reload()}>
        {f && <>
          <section className="card"><h2>Organisasi</h2><div className="form-grid">
            <Field label="Nama organisasi"><input value={f.org.name ?? ''} onChange={(e) => setF({ ...f, org: { ...f.org, name: e.target.value } })} /></Field>
            <Field label="Nama paparan CEO"><input value={f.org.ceo_name ?? ''} onChange={(e) => setF({ ...f, org: { ...f.org, ceo_name: e.target.value } })} /></Field>
            <Field label="Bahasa lalai"><select value={f.org.language} onChange={(e) => setF({ ...f, org: { ...f.org, language: e.target.value } })}>{LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select></Field>
            <Field label="Zon masa"><input value={f.org.timezone ?? ''} onChange={(e) => setF({ ...f, org: { ...f.org, timezone: e.target.value } })} /></Field>
          </div></section>
          <section className="card"><h2>Mod demo</h2>
            <label className="check"><input type="checkbox" checked={Boolean(f.demo_mode)} onChange={(e) => setF({ ...f, demo_mode: e.target.checked })} /> Paparkan label mod demo di seluruh aplikasi</label>
            <p className="muted">Data contoh sentiasa ditanda DEMO dan larian tanpa penyedia AI sentiasa ditanda SIMULASI, tanpa mengira tetapan ini.</p></section>
          <section className="card"><h2>Had & ambang</h2><div className="form-grid">
            <Field label="Had kos AI bulanan organisasi (USD)" hint="0 = tiada had. Apabila dicapai, tugasan ditahan."><input type="number" min={0} value={f.org_monthly_cost_limit} onChange={(e) => setF({ ...f, org_monthly_cost_limit: e.target.value })} /></Field>
            <Field label="Ambang keyakinan automatik (%)" hint="Di bawah ambang ini, agent mesti meminta kelulusan."><input type="number" min={0} max={100} value={f.confidence_pct} onChange={(e) => setF({ ...f, confidence_pct: e.target.value })} /></Field>
          </div></section>
          <section className="card"><h2>Keselamatan</h2>
            {session.secured ? <div className="notice notice-info">Log masuk CEO dilindungi PIN (<code>GD_CEO_PIN</code>).</div> : <div className="notice notice-warn">PIN CEO belum ditetapkan. Tetapkan <code>GD_CEO_PIN</code> (dan <code>GD_PA_PIN</code>) dalam fail <code>.env</code> pelayan, kemudian mulakan semula.</div>}
            <p className="muted">PIN dan kunci induk rahsia (<code>GD_MASTER_KEY</code>) hanya dibaca daripada environment variables di pelayan.</p></section>
          <button className="btn btn-primary" onClick={save}>Simpan tetapan</button>
        </>}
      </States>
    </div>
  );
}
