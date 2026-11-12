import type { Session } from '../api';
import { Badge, States, StatusBadge, STATUS_LABEL, fmtTime, useApi } from '../ui';

export default function Dashboard({ go }: { session: Session; go: (p: string) => void }) {
  const { data: d, error, loading, reload } = useApi<any>('/dashboard', 10000);
  const stat = (label: string, value: any, sub?: string, page?: string) => (
    <button className="stat" onClick={() => page && go(page)} disabled={!page}><div className="stat-value">{value}</div><div className="stat-label">{label}</div>{sub && <div className="muted">{sub}</div>}</button>
  );
  return (
    <div className="page">
      <h1>Dashboard</h1>
      <States loading={loading} error={error} onRetry={() => void reload()}>
        {d && <>
          {d.alerts.length > 0 && <div className="alerts">{d.alerts.map((a: any, i: number) => <div key={i} className={`notice ${a.level === 'amaran' ? 'notice-warn' : 'notice-info'}`}>{a.text}</div>)}</div>}
          <div className="stats">
            {stat('Staf', d.staff, undefined, 'roster')}
            {stat('AI Agent', d.agents, `${d.agents_active} profil aktif`, 'roster')}
            {stat('Jabatan', d.departments, undefined, 'organisasi')}
            {stat('Tugasan', d.tasks_total, `${d.tasks_by_status.berjalan ?? 0} berjalan`, 'tugasan')}
            {stat('Menunggu kelulusan', d.approvals_pending, 'perlu keputusan anda', 'kelulusan')}
            {stat('Kos AI bulan ini', `$${d.usage.cost.toFixed(2)}`, d.usage.limit ? `had $${d.usage.limit}` : 'tiada had', 'integrasi')}
          </div>
          <div className="grid-2">
            <section className="card"><h2>Tugasan mengikut status</h2>
              {Object.keys(d.tasks_by_status).length === 0 ? <p className="muted">Belum ada tugasan.</p> :
                <div className="bars">{Object.entries(d.tasks_by_status).map(([s, n]: any) => <div key={s} className="bar-row"><span>{STATUS_LABEL[s] ?? s}</span><div className="bar"><div style={{ width: `${(n / d.tasks_total) * 100}%` }} /></div><b>{n}</b></div>)}</div>}
            </section>
            <section className="card"><h2>Penggunaan AI ({d.usage.month})</h2>
              <table className="kv"><tbody>
                <tr><td>Token masuk / keluar (sebenar)</td><td>{d.usage.tokens_in.toLocaleString()} / {d.usage.tokens_out.toLocaleString()}</td></tr>
                <tr><td>Anggaran kos (sebenar)</td><td>${d.usage.cost.toFixed(4)}</td></tr>
                <tr><td>Larian simulasi</td><td>{d.usage.simulated_runs} <Badge tone="demo">SIMULASI</Badge></td></tr>
              </tbody></table>
              {d.usage.limit > 0 && <div className="bar big"><div style={{ width: `${Math.min(100, (d.usage.cost / d.usage.limit) * 100)}%` }} /></div>}
              <h3>Sambungan</h3>
              <ul className="plain">{d.connectors.map((c: any, i: number) => <li key={i}>{c.name} <StatusBadge status={c.status} /></li>)}</ul>
            </section>
            <section className="card"><h2>Jabatan</h2>
              <table><thead><tr><th>Jabatan</th><th>Ahli</th><th>Tugasan terbuka</th></tr></thead><tbody>
                {d.by_department.map((x: any) => <tr key={x.name}><td><span className="dot" style={{ background: x.color }} />{x.name}</td><td>{x.members}</td><td>{x.open_tasks}</td></tr>)}
              </tbody></table>
            </section>
            <section className="card"><h2>Aktiviti terkini</h2>
              <ul className="feed">{d.recent.map((a: any) => <li key={a.id}><StatusBadge status={a.outcome} /> <b>{a.actor}</b> · {a.action.replaceAll('_', ' ')} {a.is_demo ? <Badge tone="demo">DEMO</Badge> : null}<div className="muted">{fmtTime(a.ts)}{a.reason ? ` — ${a.reason}` : ''}</div></li>)}</ul>
              <button className="btn btn-small" onClick={() => go('audit')}>Lihat log audit penuh</button>
            </section>
          </div>
        </>}
      </States>
    </div>
  );
}
