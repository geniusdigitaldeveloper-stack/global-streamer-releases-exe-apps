import { useState } from 'react';
import type { Session } from '../api';
import { Badge, States, StatusBadge, fmtTime, useApi } from '../ui';

export default function Audit(_: { session: Session; go: (p: string) => void }) {
  const [q, setQ] = useState('');
  const [outcome, setOutcome] = useState('');
  const { data, error, loading, reload } = useApi<any[]>(`/audit?limit=300&q=${encodeURIComponent(q)}&outcome=${outcome}`);
  return (
    <div className="page">
      <h1>Log Audit</h1>
      <p className="muted">Setiap keputusan dan tindakan direkod, termasuk sebab sesuatu tindakan ditolak atau ditahan. Nilai rahsia tidak pernah direkod.</p>
      <div className="toolbar">
        <input placeholder="Cari tindakan, pelaku atau sebab…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="">Semua hasil</option><option value="berjaya">Berjaya</option><option value="dibenarkan">Dibenarkan</option><option value="ditolak">Ditolak</option><option value="ditahan">Ditahan</option><option value="gagal">Gagal</option>
        </select>
        <button className="btn" onClick={() => void reload()}>Segar semula</button>
      </div>
      <States loading={loading && !data} error={error} onRetry={() => void reload()} empty={data?.length === 0} emptyText="Tiada rekod audit sepadan.">
        <div className="table-wrap"><table><thead><tr><th>Masa</th><th>Pelaku</th><th>Tindakan</th><th>Entiti</th><th>Hasil</th><th>Sebab / butiran</th></tr></thead><tbody>
          {data?.map((a) => <tr key={a.id}><td className="nowrap">{fmtTime(a.ts)}</td><td>{a.actor}</td><td>{a.action.replaceAll('_', ' ')} {a.is_demo ? <Badge tone="demo">DEMO</Badge> : null}</td><td>{a.entity}{a.entity_id ? ` #${a.entity_id}` : ''}</td><td><StatusBadge status={a.outcome} /></td>
            <td>{a.reason}{a.detail && Object.keys(a.detail).length > 0 && <details><summary>butiran</summary><pre>{JSON.stringify(a.detail, null, 1)}</pre></details>}</td></tr>)}
        </tbody></table></div>
      </States>
    </div>
  );
}
